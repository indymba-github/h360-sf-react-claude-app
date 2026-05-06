import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatCurrency, formatDate, formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

export const getOpportunitiesSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Filter opportunities by Account ID"),
  stage: z
    .string()
    .optional()
    .describe("Filter by StageName (e.g. 'Prospecting', 'Closed Won')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of records to return (1-50, default 10)"),
});

export type GetOpportunitiesInput = z.infer<typeof getOpportunitiesSchema>;

interface OpportunityRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
  Probability: number | null;
  Account: { Name: string } | null;
}

export interface OpportunityData {
  id: string;
  name: string;
  stageName: string;
  amount: number | null;
  closeDate: string;
  probability: number | null;
  accountName: string | null;
}

export async function getOpportunities(
  input: GetOpportunitiesInput
): Promise<{ text: string; data: OpportunityData[] }> {
  const clauses: string[] = [];

  if (input.account_id) {
    const safe = input.account_id.replace(/'/g, "\\'");
    clauses.push(`AccountId = '${safe}'`);
  }
  if (input.stage) {
    const safe = input.stage.replace(/'/g, "\\'");
    clauses.push(`StageName = '${safe}'`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const soql = `
    SELECT Id, Name, StageName, Amount, CloseDate, Probability, Account.Name
    FROM Opportunity
    ${where}
    ORDER BY CloseDate ASC
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<OpportunityRecord>(soql);

    const data: OpportunityData[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      stageName: r.StageName,
      amount: r.Amount,
      closeDate: r.CloseDate,
      probability: r.Probability,
      accountName: r.Account?.Name ?? null,
    }));

    const header = `Found ${data.length} opportunity(ies):\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      return [
        `${i + 1}. ${r.name}`,
        `   Account:     ${r.accountName ?? "N/A"}`,
        `   Stage:       ${r.stageName}`,
        `   Amount:      ${formatCurrency(r.amount)}`,
        `   Close Date:  ${formatDate(r.closeDate)}`,
        `   Probability: ${r.probability != null ? `${r.probability}%` : "N/A"}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_get_opportunities failed: ${toMcpError(err)}`);
  }
}
