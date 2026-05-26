import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

export const getContactsSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Filter contacts by Account ID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of records to return (1-50, default 10)"),
});

export type GetContactsInput = z.infer<typeof getContactsSchema>;

interface ContactRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  Title: string | null;
  Email: string | null;
  Phone: string | null;
  Department: string | null;
  Account: { Name: string } | null;
}

export interface ContactData {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  accountName: string | null;
}

export async function getContacts(
  input: GetContactsInput
): Promise<{ text: string; data: ContactData[] }> {
  const clauses: string[] = [];

  if (input.account_id) {
    const safe = input.account_id.replace(/'/g, "\\'");
    clauses.push(`AccountId = '${safe}'`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const soql = `
    SELECT Id, Name, Title, Email, Phone, Department, Account.Name
    FROM Contact
    ${where}
    ORDER BY Name ASC
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<ContactRecord>(soql);

    const data: ContactData[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      title: r.Title,
      email: r.Email,
      phone: r.Phone,
      department: r.Department,
      accountName: r.Account?.Name ?? null,
    }));

    const header = `Found ${data.length} contact(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      return [
        `${i + 1}. ${r.name}`,
        `   Account:    ${r.accountName ?? "N/A"}`,
        `   Title:      ${r.title ?? "N/A"}`,
        `   Email:      ${r.email ?? "N/A"}`,
        `   Phone:      ${r.phone ?? "N/A"}`,
        `   Department: ${r.department ?? "N/A"}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_get_contacts failed: ${toMcpError(err)}`);
  }
}
