import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatDate, formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

// ── Schemas ────────────────────────────────────────────────────────────────

export const getNewsAlertsSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Filter alerts by Account ID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of records to return (1-50, default 10)"),
});

export const getTasksSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Filter tasks by Account ID"),
  status: z
    .string()
    .optional()
    .describe("Filter by Status (e.g. 'Not Started', 'In Progress', 'Completed')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of records to return (1-50, default 10)"),
});

export type GetNewsAlertsInput = z.infer<typeof getNewsAlertsSchema>;
export type GetTasksInput      = z.infer<typeof getTasksSchema>;

// ── Types ──────────────────────────────────────────────────────────────────

interface TaskRecord extends SFQueryRecord {
  Id: string;
  Subject: string | null;
  Status: string;
  Priority: string | null;
  ActivityDate: string | null;
  Description: string | null;
  WhatId: string | null;
  What: { Name: string } | null;
  WhoId: string | null;
  Who: { Name: string } | null;
  CreatedDate: string;
  Owner: { Name: string } | null;
}

export interface TaskData {
  id: string;
  subject: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  description: string | null;
  accountId: string | null;
  accountName: string | null;
  contactName: string | null;
  ownerName: string | null;
  createdDate: string;
}

const TASK_SOQL = `
  SELECT Id, Subject, Status, Priority,
    ActivityDate, Description,
    WhatId, What.Name,
    WhoId, Who.Name,
    CreatedDate, Owner.Name
  FROM Task
`;

function mapTask(r: TaskRecord): TaskData {
  return {
    id:          r.Id,
    subject:     r.Subject,
    status:      r.Status,
    priority:    r.Priority,
    dueDate:     r.ActivityDate,
    description: r.Description,
    accountId:   r.WhatId,
    accountName: r.What?.Name ?? null,
    contactName: r.Who?.Name ?? null,
    ownerName:   r.Owner?.Name ?? null,
    createdDate: r.CreatedDate,
  };
}

function formatTaskList(data: TaskData[]): string {
  const header = `Found ${data.length} task(s):\n${"─".repeat(40)}`;
  const body = formatList(data, (t, i) =>
    [
      `${i + 1}. ${t.subject ?? "(no subject)"}`,
      `   Status:   ${t.status}${t.priority ? ` | Priority: ${t.priority}` : ""}`,
      t.accountName ? `   Account:  ${t.accountName}` : null,
      t.contactName ? `   Contact:  ${t.contactName}` : null,
      t.dueDate     ? `   Due:      ${formatDate(t.dueDate)}` : null,
      t.ownerName   ? `   Owner:    ${t.ownerName}` : null,
      `   Created:  ${formatDate(t.createdDate)}`,
    ].filter(Boolean).join("\n")
  );
  return `${header}\n\n${body}`;
}

// ── Tool handlers ──────────────────────────────────────────────────────────

export async function getNewsAlerts(
  input: GetNewsAlertsInput
): Promise<{ text: string; data: TaskData[] }> {
  const clauses = ["Subject LIKE 'News Alert:%'", "Status != 'Completed'"];

  if (input.account_id) {
    const safe = input.account_id.replace(/'/g, "\\'");
    clauses.push(`WhatId = '${safe}'`);
  }

  const soql = `
    ${TASK_SOQL}
    WHERE ${clauses.join(" AND ")}
    ORDER BY CreatedDate DESC
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<TaskRecord>(soql);
    const data = records.map(mapTask);
    return { text: formatTaskList(data), data };
  } catch (err) {
    throw new Error(`sf_get_news_alerts failed: ${toMcpError(err)}`);
  }
}

export async function getTasks(
  input: GetTasksInput
): Promise<{ text: string; data: TaskData[] }> {
  const clauses = ["Subject NOT LIKE 'News Alert:%'"];

  if (input.account_id) {
    const safe = input.account_id.replace(/'/g, "\\'");
    clauses.push(`WhatId = '${safe}'`);
  }
  if (input.status) {
    const safe = input.status.replace(/'/g, "\\'");
    clauses.push(`Status = '${safe}'`);
  }

  const soql = `
    ${TASK_SOQL}
    WHERE ${clauses.join(" AND ")}
    ORDER BY CreatedDate DESC
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<TaskRecord>(soql);
    const data = records.map(mapTask);
    return { text: formatTaskList(data), data };
  } catch (err) {
    throw new Error(`sf_get_tasks failed: ${toMcpError(err)}`);
  }
}
