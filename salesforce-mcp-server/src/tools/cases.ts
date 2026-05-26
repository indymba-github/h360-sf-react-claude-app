import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatDate, formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

export const getCasesSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Filter cases by Account ID"),
  status: z
    .string()
    .optional()
    .describe("Filter by Status (e.g. 'Open', 'Closed', 'Escalated')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of records to return (1-50, default 10)"),
});

export type GetCasesInput = z.infer<typeof getCasesSchema>;

interface CaseRecord extends SFQueryRecord {
  Id: string;
  CaseNumber: string;
  Subject: string | null;
  Status: string;
  Priority: string | null;
  CreatedDate: string;
  Account: { Name: string } | null;
}

export interface CaseData {
  id: string;
  caseNumber: string;
  subject: string | null;
  status: string;
  priority: string | null;
  createdDate: string;
  accountName: string | null;
}

export async function getCases(
  input: GetCasesInput
): Promise<{ text: string; data: CaseData[] }> {
  const clauses: string[] = [];

  if (input.account_id) {
    const safe = input.account_id.replace(/'/g, "\\'");
    clauses.push(`AccountId = '${safe}'`);
  }
  if (input.status) {
    const safe = input.status.replace(/'/g, "\\'");
    clauses.push(`Status = '${safe}'`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const soql = `
    SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate, Account.Name
    FROM Case
    ${where}
    ORDER BY CreatedDate DESC
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<CaseRecord>(soql);

    const data: CaseData[] = records.map((r) => ({
      id: r.Id,
      caseNumber: r.CaseNumber,
      subject: r.Subject,
      status: r.Status,
      priority: r.Priority,
      createdDate: r.CreatedDate,
      accountName: r.Account?.Name ?? null,
    }));

    const header = `Found ${data.length} case(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      return [
        `${i + 1}. [#${r.caseNumber}] ${r.subject ?? "(no subject)"}`,
        `   Account:  ${r.accountName ?? "N/A"}`,
        `   Status:   ${r.status}`,
        `   Priority: ${r.priority ?? "N/A"}`,
        `   Created:  ${formatDate(r.createdDate)}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_get_cases failed: ${toMcpError(err)}`);
  }
}
