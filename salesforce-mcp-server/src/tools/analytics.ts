import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatCurrency, formatDate, formatPercent } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

// ── sf_get_pipeline_summary ───────────────────────────────────────────────

export const getPipelineSummarySchema = z.object({});

export type GetPipelineSummaryInput = z.infer<typeof getPipelineSummarySchema>;

interface PipelineStageRecord extends SFQueryRecord {
  StageName: string;
  cnt: number;
  totalAmt: number | null;
  avgAmt: number | null;
}

interface WinRateRecord extends SFQueryRecord {
  IsWon: boolean;
  cnt: number;
}

export interface StageStats {
  stage: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
}

export interface PipelineSummaryData {
  stages: StageStats[];
  totalPipelineValue: number;
  overallWinRate: number | null;
  wonCount: number;
  lostCount: number;
}

export async function getPipelineSummary(
  _input: GetPipelineSummaryInput
): Promise<{ text: string; data: PipelineSummaryData }> {
  try {
    const [stageRecords, winRateRecords] = await Promise.all([
      query<PipelineStageRecord>(`
        SELECT StageName, COUNT(Id) cnt, SUM(Amount) totalAmt, AVG(Amount) avgAmt
        FROM Opportunity
        WHERE IsClosed = false
        GROUP BY StageName
        ORDER BY StageName
      `),
      query<WinRateRecord>(`
        SELECT IsWon, COUNT(Id) cnt
        FROM Opportunity
        WHERE IsClosed = true
        GROUP BY IsWon
      `),
    ]);

    const stages: StageStats[] = stageRecords.map((r) => ({
      stage: r.StageName,
      count: r.cnt,
      totalAmount: r.totalAmt ?? 0,
      avgAmount: r.avgAmt ?? 0,
    }));

    const totalPipelineValue = stages.reduce((sum, s) => sum + s.totalAmount, 0);

    let wonCount = 0;
    let lostCount = 0;
    for (const r of winRateRecords) {
      if (r.IsWon) wonCount = r.cnt;
      else lostCount = r.cnt;
    }
    const closedTotal = wonCount + lostCount;
    const overallWinRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : null;

    const data: PipelineSummaryData = {
      stages,
      totalPipelineValue,
      overallWinRate,
      wonCount,
      lostCount,
    };

    const divider = "─".repeat(40);
    const lines = [
      `Pipeline Summary`,
      divider,
      `Total Pipeline Value: ${formatCurrency(totalPipelineValue)}`,
      `Win Rate (historical): ${overallWinRate != null ? formatPercent(overallWinRate) : "N/A"}`,
      `  Closed Won:  ${wonCount}`,
      `  Closed Lost: ${lostCount}`,
      "",
      "Open Opportunities by Stage:",
      divider,
    ];

    if (stages.length === 0) {
      lines.push("  No open opportunities.");
    } else {
      for (const s of stages) {
        lines.push(
          `  ${s.stage}`,
          `    Count: ${s.count}  |  Total: ${formatCurrency(s.totalAmount)}  |  Avg: ${formatCurrency(s.avgAmount)}`
        );
      }
    }

    return { text: lines.join("\n"), data };
  } catch (err) {
    throw new Error(`sf_get_pipeline_summary failed: ${toMcpError(err)}`);
  }
}

// ── sf_get_recent_activity ────────────────────────────────────────────────

export const getRecentActivitySchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Total recently-modified records to return (1-50, default 10)"),
});

export type GetRecentActivityInput = z.infer<typeof getRecentActivitySchema>;

interface RecentRecord extends SFQueryRecord {
  Id: string;
  Name?: string;
  Subject?: string;
  LastModifiedDate: string;
}

export interface ActivityRecord {
  id: string;
  objectType: string;
  name: string;
  lastModifiedDate: string;
}

export async function getRecentActivity(
  input: GetRecentActivityInput
): Promise<{ text: string; data: ActivityRecord[] }> {
  // Fetch input.limit from each object — after merging and sorting we always have enough to slice.
  const perObject = input.limit;

  try {
    const [accounts, contacts, opps, cases] = await Promise.all([
      query<RecentRecord>(
        `SELECT Id, Name, LastModifiedDate FROM Account ORDER BY LastModifiedDate DESC LIMIT ${perObject}`
      ),
      query<RecentRecord>(
        `SELECT Id, Name, LastModifiedDate FROM Contact ORDER BY LastModifiedDate DESC LIMIT ${perObject}`
      ),
      query<RecentRecord>(
        `SELECT Id, Name, LastModifiedDate FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT ${perObject}`
      ),
      query<RecentRecord>(
        `SELECT Id, Subject, LastModifiedDate FROM Case ORDER BY LastModifiedDate DESC LIMIT ${perObject}`
      ),
    ]);

    const toActivity = (objectType: string) =>
      (r: RecentRecord): ActivityRecord => ({
        id: r.Id,
        objectType,
        name: r.Name ?? r.Subject ?? r.Id,
        lastModifiedDate: r.LastModifiedDate,
      });

    const all: ActivityRecord[] = [
      ...accounts.map(toActivity("Account")),
      ...contacts.map(toActivity("Contact")),
      ...opps.map(toActivity("Opportunity")),
      ...cases.map(toActivity("Case")),
    ]
      .sort(
        (a, b) =>
          new Date(b.lastModifiedDate).getTime() -
          new Date(a.lastModifiedDate).getTime()
      )
      .slice(0, input.limit);

    const header = `${all.length} recently modified record(s):\n${"─".repeat(40)}`;
    const body = all
      .map(
        (r, i) =>
          `${i + 1}. [${r.objectType}] ${r.name}\n   Modified: ${formatDate(r.lastModifiedDate)}`
      )
      .join("\n\n");

    return {
      text: `${header}\n\n${body || "No records found."}`,
      data: all,
    };
  } catch (err) {
    throw new Error(`sf_get_recent_activity failed: ${toMcpError(err)}`);
  }
}
