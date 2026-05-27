import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { query, type SFQueryRecord } from "../salesforce.js";

export const renderAccountRiskBriefingTool: Tool = {
  name: "render_account_risk_briefing",
  description:
    "Render an interactive Account Risk Briefing card for a " +
    "specific account. Surfaces Engagement Risk (activity " +
    "history, contact frequency) and Pipeline Risk (stalled " +
    "opportunities, win trends). Use when the user asks for " +
    "a risk briefing, risk view, or risk dashboard on an " +
    "account. The briefing appears as an overlay on the page; " +
    "users can ask follow-up questions from each section.",
  inputSchema: {
    type: "object",
    properties: {
      accountId: {
        type: "string",
        description: "Salesforce Account Id",
      },
    },
    required: ["accountId"],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const renderAccountRiskBriefingSchema = z.object({
  accountId: z.string().min(1).describe("Salesforce Account Id"),
});

// ── Data types ─────────────────────────────────────────────────────────────

interface ActivityRecord extends SFQueryRecord {
  Id: string;
  ActivityDate: string | null;
}

interface ContactCountRecord extends SFQueryRecord {
  expr0: number;
}

interface OpportunityRecord extends SFQueryRecord {
  Id: string;
  StageName: string;
  LastModifiedDate: string;
  CreatedDate: string;
}

interface AccountNameRecord extends SFQueryRecord {
  Id: string;
  Name: string;
}

type EngagementMetrics = {
  daysSinceLastActivity: number | null;
  activitiesLast90Days: number;
  contactCount: number;
};

type PipelineMetrics = {
  openOppCount: number;
  stalledOppCount: number;
  closedLostLast180Days: number;
  avgDaysInStage: number | null;
};

// ── Metric fetchers ────────────────────────────────────────────────────────

async function fetchEngagementMetrics(
  accountId: string
): Promise<EngagementMetrics> {
  const safeId = accountId.replace(/'/g, "\\'");
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [tasks, events, contactResult] = await Promise.all([
    query<ActivityRecord>(
      `SELECT Id, ActivityDate FROM Task WHERE AccountId = '${safeId}' ORDER BY ActivityDate DESC LIMIT 100`
    ),
    query<ActivityRecord>(
      `SELECT Id, ActivityDate FROM Event WHERE AccountId = '${safeId}' ORDER BY ActivityDate DESC LIMIT 100`
    ),
    query<ContactCountRecord>(
      `SELECT COUNT(Id) FROM Contact WHERE AccountId = '${safeId}'`
    ),
  ]);

  const todayISO = new Date().toISOString().split("T")[0];

  // Filter to past/today only — future-dated activities are scheduled work, not historical touchpoints
  const allActivities = [...tasks, ...events]
    .filter((a) => a.ActivityDate && a.ActivityDate <= todayISO)
    .sort((a, b) => (b.ActivityDate ?? "").localeCompare(a.ActivityDate ?? ""));

  const lastActivityDate = allActivities[0]?.ActivityDate ?? null;
  let daysSinceLastActivity: number | null = null;
  if (lastActivityDate) {
    const last = new Date(lastActivityDate);
    daysSinceLastActivity = Math.max(
      0,
      Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  const activitiesLast90Days = allActivities.filter(
    (a) => a.ActivityDate && a.ActivityDate >= ninetyDaysAgo
  ).length;

  const contactCount = contactResult[0]?.expr0 ?? 0;

  return { daysSinceLastActivity, activitiesLast90Days, contactCount };
}

async function fetchPipelineMetrics(
  accountId: string
): Promise<PipelineMetrics> {
  const safeId = accountId.replace(/'/g, "\\'");
  const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  interface ClosedLostRecord extends SFQueryRecord { expr0: number }

  const [openOpps, closedLostResult] = await Promise.all([
    query<OpportunityRecord>(
      `SELECT Id, StageName, LastModifiedDate, CreatedDate FROM Opportunity WHERE AccountId = '${safeId}' AND IsClosed = FALSE ORDER BY CreatedDate DESC`
    ),
    query<ClosedLostRecord>(
      `SELECT COUNT(Id) FROM Opportunity WHERE AccountId = '${safeId}' AND StageName = 'Closed Lost' AND CloseDate >= ${oneEightyDaysAgo}`
    ),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stalledOpps = openOpps.filter((opp) => {
    const lastMod = new Date(opp.LastModifiedDate);
    return lastMod < thirtyDaysAgo;
  });

  let avgDaysInStage: number | null = null;
  if (openOpps.length > 0) {
    const totalDays = openOpps.reduce((sum, opp) => {
      const lastMod = new Date(opp.LastModifiedDate);
      return sum + Math.floor((Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    avgDaysInStage = Math.floor(totalDays / openOpps.length);
  }

  return {
    openOppCount: openOpps.length,
    stalledOppCount: stalledOpps.length,
    closedLostLast180Days: closedLostResult[0]?.expr0 ?? 0,
    avgDaysInStage,
  };
}

// ── Risk dimension calculators ─────────────────────────────────────────────

function computeEngagementRisk(m: EngagementMetrics) {
  if (m.daysSinceLastActivity === null && m.activitiesLast90Days === 0 && m.contactCount === 0) {
    return {
      severity: "unknown" as const,
      summary: "Not enough activity or contact data on this account to assess engagement risk.",
      emptyState: true,
    };
  }

  const factors: string[] = [];
  let severity: "low" | "medium" | "high" = "low";

  if (m.daysSinceLastActivity === null || m.daysSinceLastActivity > 60) {
    severity = "high";
    factors.push(
      m.daysSinceLastActivity === null
        ? "No recorded activity history"
        : `Last touch was ${m.daysSinceLastActivity} days ago`
    );
  } else if (m.daysSinceLastActivity > 30) {
    severity = "medium";
    factors.push(`Last touch was ${m.daysSinceLastActivity} days ago`);
  }

  if (m.activitiesLast90Days < 3) {
    if (severity === "low") severity = "medium";
    factors.push(`Only ${m.activitiesLast90Days} activities in last 90 days`);
  }

  if (m.contactCount < 2) {
    if (severity === "low") severity = "medium";
    factors.push(
      `Single-threaded — only ${m.contactCount} contact${m.contactCount === 1 ? "" : "s"}`
    );
  }

  const summaries = {
    low: "Engagement is healthy. Activity frequency and contact breadth are within normal ranges.",
    medium: "Engagement signals warrant attention. Some activity patterns indicate potential drift.",
    high: "Engagement is at risk. Significant gaps in recent touchpoints or relationship breadth.",
  };

  return {
    severity,
    summary: summaries[severity],
    metrics: [
      {
        label: "Days Since Touch",
        value: m.daysSinceLastActivity === null ? "N/A" : String(m.daysSinceLastActivity),
      },
      { label: "Activities (90d)", value: String(m.activitiesLast90Days) },
      { label: "Contacts", value: String(m.contactCount) },
    ],
    factors: factors.length > 0 ? factors : undefined,
  };
}

function computePipelineRisk(m: PipelineMetrics) {
  if (m.openOppCount === 0 && m.closedLostLast180Days === 0) {
    return {
      severity: "unknown" as const,
      summary: "No open opportunities or recent closed-lost data on this account. Pipeline risk cannot be assessed.",
      emptyState: true,
    };
  }

  const factors: string[] = [];
  let severity: "low" | "medium" | "high" = "low";

  if (m.openOppCount === 0 && m.closedLostLast180Days > 0) {
    severity = "high";
    factors.push(
      `${m.closedLostLast180Days} lost opportunities in last 180 days and no open opportunities`
    );
  } else if (m.stalledOppCount > 0) {
    const ratio = m.stalledOppCount / m.openOppCount;
    if (ratio > 0.5) {
      severity = "high";
      factors.push(
        `${m.stalledOppCount} of ${m.openOppCount} opportunities stalled (>30 days unchanged)`
      );
    } else if (ratio > 0.25) {
      severity = "medium";
      factors.push(`${m.stalledOppCount} of ${m.openOppCount} opportunities stalled`);
    }
  }

  if (m.closedLostLast180Days >= 2 && severity !== "high") {
    severity = severity === "low" ? "medium" : severity;
    factors.push(`${m.closedLostLast180Days} lost opportunities in the last 180 days`);
  }

  if (m.avgDaysInStage !== null && m.avgDaysInStage > 60 && severity === "low") {
    severity = "medium";
    factors.push(`Avg ${m.avgDaysInStage} days since last opportunity update`);
  }

  const summaries = {
    low: "Pipeline is healthy. Opportunities are progressing within expected timeframes.",
    medium: "Pipeline signals warrant attention. Some opportunities show signs of stalling.",
    high: "Pipeline is at risk. Significant stagnation or losses indicate momentum issues.",
  };

  return {
    severity,
    summary: summaries[severity],
    metrics: [
      { label: "Open Opps", value: String(m.openOppCount) },
      { label: "Stalled", value: String(m.stalledOppCount) },
      { label: "Closed Lost (180d)", value: String(m.closedLostLast180Days) },
    ],
    factors: factors.length > 0 ? factors : undefined,
  };
}

// ── Tool executor ──────────────────────────────────────────────────────────

export async function executeRenderAccountRiskBriefing(args: {
  accountId: string;
}) {
  const safeId = args.accountId.replace(/'/g, "\\'");

  const accountRecords = await query<AccountNameRecord>(
    `SELECT Id, Name FROM Account WHERE Id = '${safeId}' LIMIT 1`
  );
  const accountName = accountRecords[0]?.Name ?? "Unknown Account";

  const [engagementMetrics, pipelineMetrics] = await Promise.all([
    fetchEngagementMetrics(args.accountId),
    fetchPipelineMetrics(args.accountId),
  ]);

  const engagementRisk = computeEngagementRisk(engagementMetrics);
  const pipelineRisk = computePipelineRisk(pipelineMetrics);

  const renderDirective = {
    component: "account_risk_briefing",
    accountId: args.accountId,
    props: {
      accountName,
      engagementRisk,
      pipelineRisk,
    },
  };

  const text =
    `Rendered risk briefing for ${accountName}. ` +
    `Engagement risk: ${engagementRisk.severity}. ` +
    `Pipeline risk: ${pipelineRisk.severity}.`;

  return {
    content: [{ type: "text" as const, text }],
    render: renderDirective,
  };
}
