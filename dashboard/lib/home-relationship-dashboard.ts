import { formatCount, formatCurrency } from "./format";

export type HomeRelationshipPipelineStage = {
  StageName: string;
  cnt: number;
  totalAmt: number | null;
};

export type HomeRelationshipCaseSignal = {
  id: string;
  subject: string | null;
  accountId: string | null;
  accountName: string | null;
  status: string;
  createdDate: string;
};

export type HomeRelationshipAgendaSignal = {
  id: string;
  type: "event" | "task";
  subject: string;
  relatedName: string | null;
  relatedId: string | null;
};

export type HomeRelationshipRecentAccountSignal = {
  id: string;
  name: string;
  industry: string | null;
  lastModifiedDate: string;
};

export type HomePipelineAllocationSlice = {
  stageName: string;
  count: number;
  amount: number;
  amountLabel: string;
  percent: number;
};

export type RelationshipCoverageSegment = {
  id: "recent" | "stale" | "unclassified";
  label: string;
  count: number;
  percent: number;
  detail: string;
};

export type ServicePressureRow = {
  accountId: string | null;
  accountName: string;
  caseCount: number;
  latestSubject: string;
  latestStatus: string;
  href?: string;
};

export type NextRelationshipAction = {
  id: "service" | "stale-coverage" | "agenda" | "movement" | "quiet";
  label: string;
  title: string;
  detail: string;
  href?: string;
};

export type HomeRelationshipDashboardInput = {
  accountCount: number;
  recentlyTouchedCount: number;
  staleAccountCount: number;
  pipelineStages: HomeRelationshipPipelineStage[];
  highPriorityCases: HomeRelationshipCaseSignal[];
  agendaItems: HomeRelationshipAgendaSignal[];
  recentAccounts: HomeRelationshipRecentAccountSignal[];
};

export type HomeRelationshipDashboard = {
  pipeline: {
    totalAmount: number;
    slices: HomePipelineAllocationSlice[];
    takeaway: string;
  };
  coverage: {
    totalCount: number;
    segments: RelationshipCoverageSegment[];
    takeaway: string;
  };
  servicePressure: {
    rows: ServicePressureRow[];
    takeaway: string;
  };
  nextActions: NextRelationshipAction[];
};

function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralLabel}`;
}

function cleanText(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildPipeline(input: HomeRelationshipDashboardInput): HomeRelationshipDashboard["pipeline"] {
  const totalAmount = input.pipelineStages.reduce((sum, stage) => sum + (stage.totalAmt ?? 0), 0);
  const slices = input.pipelineStages
    .map((stage) => {
      const amount = stage.totalAmt ?? 0;
      return {
        stageName: stage.StageName,
        count: stage.cnt,
        amount,
        amountLabel: formatCurrency(amount),
        percent: percentOf(amount, totalAmount),
      };
    })
    .filter((slice) => slice.amount > 0 || slice.count > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.stageName.localeCompare(b.stageName));

  const topSlice = slices[0];
  return {
    totalAmount,
    slices,
    takeaway: topSlice
      ? `${topSlice.stageName} holds ${topSlice.percent}% of open pipeline dollars.`
      : "No open pipeline allocation is available.",
  };
}

function buildCoverage(input: HomeRelationshipDashboardInput): HomeRelationshipDashboard["coverage"] {
  const totalCount = Math.max(0, input.accountCount);
  const recentlyTouched = Math.max(0, Math.min(input.recentlyTouchedCount, totalCount));
  const stale = Math.max(0, Math.min(input.staleAccountCount, Math.max(0, totalCount - recentlyTouched)));
  const unclassified = Math.max(0, totalCount - recentlyTouched - stale);
  const segments: RelationshipCoverageSegment[] = [
    {
      id: "recent",
      label: "Touched recently",
      count: recentlyTouched,
      percent: percentOf(recentlyTouched, totalCount),
      detail: "Activity in the last 30 days",
    },
    {
      id: "stale",
      label: "Needs outreach",
      count: stale,
      percent: percentOf(stale, totalCount),
      detail: "No recent activity signal",
    },
    {
      id: "unclassified",
      label: "Steady state",
      count: unclassified,
      percent: percentOf(unclassified, totalCount),
      detail: "No immediate relationship signal",
    },
  ];

  return {
    totalCount,
    segments,
    takeaway: stale > 0
      ? `${plural(stale, "relationship")} are stale or missing activity.`
      : "No stale relationship coverage signal is visible.",
  };
}

function buildServicePressure(input: HomeRelationshipDashboardInput): HomeRelationshipDashboard["servicePressure"] {
  const grouped = new Map<string, {
    accountId: string | null;
    accountName: string;
    cases: HomeRelationshipCaseSignal[];
  }>();

  for (const item of input.highPriorityCases) {
    const accountName = cleanText(item.accountName, "Unassigned account");
    const key = item.accountId ?? accountName;
    const existing = grouped.get(key);
    if (existing) {
      existing.cases.push(item);
      continue;
    }

    grouped.set(key, {
      accountId: item.accountId,
      accountName,
      cases: [item],
    });
  }

  const rows = [...grouped.values()]
    .map((group) => {
      const sortedCases = [...group.cases].sort((a, b) => b.createdDate.localeCompare(a.createdDate));
      const latestCase = sortedCases[0];
      return {
        accountId: group.accountId,
        accountName: group.accountName,
        caseCount: group.cases.length,
        latestSubject: cleanText(latestCase?.subject, "High-priority case"),
        latestStatus: cleanText(latestCase?.status, "Open"),
        ...(group.accountId ? { href: `/accounts/${group.accountId}` } : {}),
      };
    })
    .sort((a, b) => b.caseCount - a.caseCount || a.accountName.localeCompare(b.accountName));

  const topRow = rows[0];
  return {
    rows,
    takeaway: topRow
      ? `${topRow.accountName} has ${plural(topRow.caseCount, "high-priority case")} open.`
      : "No high-priority service pressure is visible.",
  };
}

function buildNextActions(input: HomeRelationshipDashboardInput): NextRelationshipAction[] {
  const actions: NextRelationshipAction[] = [];
  const topCase = input.highPriorityCases[0];
  const topAgenda = input.agendaItems[0];
  const topRecent = input.recentAccounts[0];

  if (topCase) {
    const accountName = cleanText(topCase.accountName, "Service queue");
    const caseSubject = cleanText(topCase.subject, "High-priority case");
    actions.push({
      id: "service",
      label: "Service",
      title: accountName,
      detail: `${caseSubject}. ${plural(input.highPriorityCases.length, "high-priority case")} open across the current book.`,
      ...(topCase.accountId ? { href: `/accounts/${topCase.accountId}` } : {}),
    });
  }

  if (input.staleAccountCount > 0) {
    actions.push({
      id: "stale-coverage",
      label: "Coverage",
      title: "Needs-attention accounts",
      detail: `${plural(input.staleAccountCount, "stale or no-activity relationship")} need a next touch across your book.`,
      href: "/accounts?filter=needs-attention",
    });
  }

  if (topAgenda) {
    const related = topAgenda.relatedName ? ` with ${topAgenda.relatedName}` : "";
    actions.push({
      id: "agenda",
      label: topAgenda.type === "event" ? "Meeting" : "Task",
      title: topAgenda.subject,
      detail: `Prepare for ${topAgenda.subject}${related}.`,
      ...(topAgenda.relatedId ? { href: `/accounts/${topAgenda.relatedId}` } : {}),
    });
  }

  if (topRecent) {
    actions.push({
      id: "movement",
      label: "Movement",
      title: topRecent.name,
      detail: `Review the latest ${topRecent.industry ?? "account"} update while it is fresh.`,
      href: `/accounts/${topRecent.id}`,
    });
  }

  if (actions.length === 0) {
    return [{
      id: "quiet",
      label: "Book",
      title: "No relationship actions surfaced",
      detail: "No urgent service, stale coverage, agenda, or account movement signal is visible.",
    }];
  }

  return actions.slice(0, 4);
}

export function buildHomeRelationshipDashboard(input: HomeRelationshipDashboardInput): HomeRelationshipDashboard {
  return {
    pipeline: buildPipeline(input),
    coverage: buildCoverage(input),
    servicePressure: buildServicePressure(input),
    nextActions: buildNextActions(input),
  };
}
