import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatCurrency, formatNumber, formatDate, formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

// ── sf_list_accounts ──────────────────────────────────────────────────────

export const listAccountsSchema = z.object({
  industry: z.string().optional().describe("Filter by Industry field (e.g. 'Technology')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of records to return (1-50, default 10)"),
});

export type ListAccountsInput = z.infer<typeof listAccountsSchema>;

interface AccountSummaryRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  Industry: string | null;
  AnnualRevenue: number | null;
  NumberOfEmployees: number | null;
  BillingState: string | null;
}

export interface AccountSummary {
  id: string;
  name: string;
  industry: string | null;
  annualRevenue: number | null;
  numberOfEmployees: number | null;
  billingState: string | null;
}

export async function listAccounts(
  input: ListAccountsInput
): Promise<{ text: string; data: AccountSummary[] }> {
  const clauses: string[] = [];

  if (input.industry) {
    const safe = input.industry.replace(/'/g, "\\'");
    clauses.push(`Industry = '${safe}'`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const soql = `
    SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, BillingState
    FROM Account
    ${where}
    ORDER BY Name ASC
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<AccountSummaryRecord>(soql);

    const data: AccountSummary[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      industry: r.Industry,
      annualRevenue: r.AnnualRevenue,
      numberOfEmployees: r.NumberOfEmployees,
      billingState: r.BillingState,
    }));

    const header = `Found ${data.length} account(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) =>
      [
        `${i + 1}. ${r.name}`,
        `   Industry:  ${r.industry ?? "N/A"}`,
        `   Revenue:   ${formatCurrency(r.annualRevenue)}`,
        `   Employees: ${formatNumber(r.numberOfEmployees)}`,
        `   State:     ${r.billingState ?? "N/A"}`,
      ].join("\n")
    );

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_list_accounts failed: ${toMcpError(err)}`);
  }
}

// ── sf_get_account ────────────────────────────────────────────────────────

export const getAccountSchema = z.object({
  account_id: z.string().min(1).describe("Salesforce Account ID (15 or 18 character)"),
});

export type GetAccountInput = z.infer<typeof getAccountSchema>;

interface AccountDetailRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  Type: string | null;
  Industry: string | null;
  AnnualRevenue: number | null;
  NumberOfEmployees: number | null;
  Phone: string | null;
  Website: string | null;
  BillingStreet: string | null;
  BillingCity: string | null;
  BillingState: string | null;
  BillingPostalCode: string | null;
  BillingCountry: string | null;
  Description: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
  Owner: { Name: string } | null;
}

export interface AccountDetail {
  id: string;
  name: string;
  type: string | null;
  industry: string | null;
  annualRevenue: number | null;
  numberOfEmployees: number | null;
  phone: string | null;
  website: string | null;
  billingAddress: string | null;
  description: string | null;
  ownerName: string | null;
  createdDate: string;
  lastModifiedDate: string;
}

export async function getAccount(
  input: GetAccountInput
): Promise<{ text: string; data: AccountDetail }> {
  const safe = input.account_id.replace(/'/g, "\\'");
  const soql = `
    SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees,
           Phone, Website,
           BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
           Description, CreatedDate, LastModifiedDate, Owner.Name
    FROM Account
    WHERE Id = '${safe}'
    LIMIT 1
  `.trim();

  try {
    const records = await query<AccountDetailRecord>(soql);

    if (records.length === 0) {
      throw new Error(`No account found with ID: ${input.account_id}`);
    }

    const r = records[0];

    const billingParts = [
      r.BillingStreet,
      r.BillingCity,
      r.BillingState,
      r.BillingPostalCode,
      r.BillingCountry,
    ].filter(Boolean);
    const billingAddress = billingParts.length > 0 ? billingParts.join(", ") : null;

    const data: AccountDetail = {
      id: r.Id,
      name: r.Name,
      type: r.Type,
      industry: r.Industry,
      annualRevenue: r.AnnualRevenue,
      numberOfEmployees: r.NumberOfEmployees,
      phone: r.Phone,
      website: r.Website,
      billingAddress,
      description: r.Description,
      ownerName: r.Owner?.Name ?? null,
      createdDate: r.CreatedDate,
      lastModifiedDate: r.LastModifiedDate,
    };

    const text = [
      `Account: ${data.name}`,
      "─".repeat(40),
      `ID:          ${data.id}`,
      `Type:        ${data.type ?? "N/A"}`,
      `Industry:    ${data.industry ?? "N/A"}`,
      `Revenue:     ${formatCurrency(data.annualRevenue)}`,
      `Employees:   ${formatNumber(data.numberOfEmployees)}`,
      `Phone:       ${data.phone ?? "N/A"}`,
      `Website:     ${data.website ?? "N/A"}`,
      `Address:     ${data.billingAddress ?? "N/A"}`,
      `Owner:       ${data.ownerName ?? "N/A"}`,
      `Created:     ${formatDate(data.createdDate)}`,
      `Modified:    ${formatDate(data.lastModifiedDate)}`,
      ...(data.description
        ? ["", "Description:", data.description.slice(0, 500)]
        : []),
    ].join("\n");

    return { text, data };
  } catch (err) {
    throw new Error(`sf_get_account failed: ${toMcpError(err)}`);
  }
}
