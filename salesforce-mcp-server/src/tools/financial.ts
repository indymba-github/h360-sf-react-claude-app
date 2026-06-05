import { z } from "zod";
import { query, getConnection, type SFQueryRecord } from "../salesforce.js";
import { formatCurrency, formatPercent, formatDate, formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

// ── sf_get_financial_accounts ─────────────────────────────────────────────

export const getFinancialAccountsSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Salesforce Account ID of the owner. If omitted, returns all."),
  account_type: z
    .string()
    .optional()
    .describe("Filter by Type (e.g. 'Checking', 'Savings', 'Investment Account', 'Loan')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Records to return (1-50, default 20)"),
});

export type GetFinancialAccountsInput = z.infer<typeof getFinancialAccountsSchema>;

interface FinancialAccountRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  FinancialAccountNumber: string | null;
  Type: string | null;
  Status: string | null;
  OpeningDate: string | null;
  ClosingDate: string | null;
  InterestRate: number | null;
  InterestType: string | null;
  TotalOutstandingAmount: number | null;
  PrincipalAmount: number | null;
  AmountDue: number | null;
  PaymentDueDate: string | null;
  CreditLimit: number | null;
  MaturityDate: string | null;
  IsOverdraftAllowed: boolean | null;
  IsHeldAway: boolean | null;
}

interface FinancialAccountBalanceRecord extends SFQueryRecord {
  FinancialAccountId: string;
  Amount: number | null;
}

export interface FinancialAccount {
  id: string;
  name: string;
  accountNumber: string | null;
  type: string | null;
  status: string | null;
  openingDate: string | null;
  closingDate: string | null;
  interestRate: number | null;
  interestType: string | null;
  totalOutstandingAmount: number | null;
  principalAmount: number | null;
  amountDue: number | null;
  paymentDueDate: string | null;
  creditLimit: number | null;
  maturityDate: string | null;
  currentBalance: number | null;
}

export async function getFinancialAccounts(
  input: GetFinancialAccountsInput
): Promise<{ text: string; data: FinancialAccount[] }> {
  console.error('[financial] ═══════════════════════════════');
  console.error('[financial] sf_get_financial_accounts INVOKED');
  console.error('[financial] args:', JSON.stringify(input));
  try {
    const conn = await getConnection();
    console.error('[financial] CONNECTED AS:');
    console.error('[financial]   instanceUrl:', conn.instanceUrl);
    console.error('[financial]   passthrough mode:', !!(process.env['SF_ACCESS_TOKEN']));
    console.error('[financial]   token prefix:', conn.accessToken?.substring(0, 20));
  } catch (idErr: unknown) {
    console.error('[financial] connection check failed:', (idErr as Error).message);
  }

  try {
    // Step 1: resolve account IDs owned by this person via FinancialAccountParty
    let faIds: string[] = [];
    if (input.account_id) {
      const safe = input.account_id.replace(/'/g, "\\'");
      const partyQuery = `SELECT Id, FinancialAccountId, AccountId, Role, IsRoleActive FROM FinancialAccountParty WHERE AccountId = '${safe}' AND Role = 'Owner' AND IsRoleActive = true`;
      console.error('[financial] STEP 1 SOQL:', partyQuery);
      const parties = await query<{ FinancialAccountId: string; Role: string; IsRoleActive: boolean } & SFQueryRecord>(partyQuery);
      console.error('[financial] STEP 1 RESULT: parties found =', parties.length);
      if (parties.length > 0) console.error('[financial]   sample:', JSON.stringify(parties[0]));
      faIds = parties.map((p) => p.FinancialAccountId);
      if (faIds.length === 0) {
        console.error('[financial] STEP 1 returned 0 — running diagnostics...');
        try {
          const diagAll = await query<{ FinancialAccountId: string; Role: string; IsRoleActive: boolean } & SFQueryRecord>(
            `SELECT Id, FinancialAccountId, Role, IsRoleActive FROM FinancialAccountParty WHERE AccountId = '${safe}' LIMIT 10`
          );
          console.error('[financial]   any FAP for this account (no role filter):', diagAll.length);
          if (diagAll.length > 0) console.error('[financial]   roles:', diagAll.map((r) => `${r.Role}/${r.IsRoleActive}`).join(', '));
          const diagTotal = await query<{ cnt: number } & SFQueryRecord>(`SELECT COUNT(Id) cnt FROM FinancialAccountParty LIMIT 1`);
          console.error('[financial]   total FAP visible to user:', JSON.stringify(diagTotal));
        } catch (diagErr: unknown) {
          console.error('[financial]   diagnostic query failed:', (diagErr as Error).message);
        }
        console.error('[financial] ═══════════════════════════════');
        return { text: `No FinancialAccountParty records found for account ${input.account_id}.`, data: [] };
      }
    }

    const idClause = faIds.length > 0
      ? `Id IN (${faIds.map((id) => `'${id}'`).join(",")})`
      : "Id != null";

    const typeClauses: string[] = [idClause];
    if (input.account_type) {
      typeClauses.push(`Type = '${input.account_type.replace(/'/g, "\\'")}'`);
    }

    const faQuery = `SELECT Id, Name, FinancialAccountNumber, Type, Status, OpeningDate, ClosingDate, InterestRate, InterestType, TotalOutstandingAmount, PrincipalAmount, AmountDue, PaymentDueDate, CreditLimit, MaturityDate, IsOverdraftAllowed, IsHeldAway FROM FinancialAccount WHERE ${typeClauses.join(" AND ")} LIMIT ${input.limit}`;
    console.error('[financial] STEP 2 SOQL:', faQuery);
    const [accounts, balances] = await Promise.all([
      query<FinancialAccountRecord>(faQuery),
      faIds.length > 0
        ? query<FinancialAccountBalanceRecord>(`
            SELECT FinancialAccountId, Amount
            FROM FinancialAccountBalance
            WHERE FinancialAccountId IN (${faIds.map((id) => `'${id}'`).join(",")})
              AND Type = 'Total Balance'
            ORDER BY BalanceAsOfDate DESC NULLS LAST, SystemModstamp DESC
          `).catch(() => [] as FinancialAccountBalanceRecord[])
        : Promise.resolve([] as FinancialAccountBalanceRecord[]),
    ]);

    console.error('[financial] STEP 2 RESULT: accounts =', accounts.length, '| balances =', balances.length);
    if (accounts.length > 0) console.error('[financial]   first account:', JSON.stringify(accounts[0]));
    console.error('[financial] ═══════════════════════════════');
    // Latest balance per FA ID (query is already ordered desc)
    const balanceMap = new Map<string, FinancialAccountBalanceRecord>();
    for (const b of balances) {
      if (!balanceMap.has(b.FinancialAccountId)) balanceMap.set(b.FinancialAccountId, b);
    }

    const data: FinancialAccount[] = accounts.map((r) => {
      const bal = balanceMap.get(r.Id);
      return {
        id: r.Id,
        name: r.Name,
        accountNumber: r.FinancialAccountNumber,
        type: r.Type,
        status: r.Status,
        openingDate: r.OpeningDate,
        closingDate: r.ClosingDate,
        interestRate: r.InterestRate,
        interestType: r.InterestType,
        totalOutstandingAmount: r.TotalOutstandingAmount,
        principalAmount: r.PrincipalAmount,
        amountDue: r.AmountDue,
        paymentDueDate: r.PaymentDueDate,
        creditLimit: r.CreditLimit,
        maturityDate: r.MaturityDate,
        currentBalance: bal?.Amount ?? null,
      };
    });

    const header = `Found ${data.length} financial account(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (a, i) => {
      const lines = [
        `${i + 1}. ${a.name}`,
        `   Type: ${a.type ?? "N/A"}  |  Status: ${a.status ?? "N/A"}`,
        `   Balance: ${formatCurrency(a.currentBalance)}`,
      ];
      if (a.creditLimit != null)
        lines.push(`   Credit Limit: ${formatCurrency(a.creditLimit)}`);
      if (a.interestRate != null)
        lines.push(`   Interest Rate: ${formatPercent(a.interestRate)}`);
      if (a.totalOutstandingAmount != null)
        lines.push(`   Outstanding: ${formatCurrency(a.totalOutstandingAmount)}`);
      if (a.amountDue != null)
        lines.push(`   Payment Due: ${formatCurrency(a.amountDue)}  on  ${formatDate(a.paymentDueDate)}`);
      if (a.openingDate)
        lines.push(`   Opened: ${formatDate(a.openingDate)}`);
      return lines.join("\n");
    });

    console.error('[financial] sf_get_financial_accounts RESULT count:', data.length);
    return { text: `${header}\n\n${body}`, data };
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error('[financial] sf_get_financial_accounts ERROR:');
    console.error('[financial]   message:', e?.message);
    console.error('[financial]   errorCode:', e?.errorCode);
    console.error('[financial]   name:', e?.name);
    console.error('[financial]   body:', typeof e?.body === 'string' ? e.body : JSON.stringify(e?.body));
    console.error('[financial]   full:', JSON.stringify(err));
    throw new Error(`sf_get_financial_accounts failed: ${toMcpError(err)}`);
  }
}


// ── sf_get_client_summary ─────────────────────────────────────────────────

export const getClientSummarySchema = z.object({
  account_id: z
    .string()
    .min(1)
    .describe("Salesforce Account ID"),
});

export type GetClientSummaryInput = z.infer<typeof getClientSummarySchema>;

interface ClientSummaryFARecord extends SFQueryRecord {
  Type: string | null;
}

interface ClientSummaryBalanceRecord extends SFQueryRecord {
  FinancialAccountId: string;
  Amount: number | null;
}

interface ClientAccountNameRecord extends SFQueryRecord {
  Name: string;
}

interface FinancialTypeSummary {
  type: string;
  count: number;
  totalBalance: number;
}

export interface ClientSummaryData {
  accountId: string;
  accountName: string | null;
  financialAccountsByType: FinancialTypeSummary[];
  totalFinancialBalance: number;
}

export async function getClientSummary(
  input: GetClientSummaryInput
): Promise<{ text: string; data: ClientSummaryData }> {
  console.error('[financial] ═══════════════════════════════');
  console.error('[financial] sf_get_client_summary INVOKED');
  console.error('[financial] args:', JSON.stringify(input));
  const safe = input.account_id.replace(/'/g, "\\'");

  try {
    // Step 1: get owned FA IDs via FinancialAccountParty
    const parties = await query<{ FinancialAccountId: string } & SFQueryRecord>(
      `SELECT FinancialAccountId FROM FinancialAccountParty WHERE AccountId = '${safe}' AND Role = 'Owner' AND IsRoleActive = true LIMIT 200`
    );
    const faIds = parties.map((p) => p.FinancialAccountId);

    const [nameRecords, faTypes, balances] = await Promise.all([
      query<ClientAccountNameRecord>(`SELECT Name FROM Account WHERE Id = '${safe}' LIMIT 1`),
      faIds.length > 0
        ? query<ClientSummaryFARecord>(`SELECT Type FROM FinancialAccount WHERE Id IN (${faIds.map((id) => `'${id}'`).join(",")})`)
        : Promise.resolve([] as ClientSummaryFARecord[]),
      faIds.length > 0
        ? query<ClientSummaryBalanceRecord>(`
            SELECT FinancialAccountId, Amount
            FROM FinancialAccountBalance
            WHERE FinancialAccountId IN (${faIds.map((id) => `'${id}'`).join(",")})
              AND Type = 'Total Balance'
            ORDER BY BalanceAsOfDate DESC NULLS LAST, SystemModstamp DESC
          `).catch(() => [] as ClientSummaryBalanceRecord[])
        : Promise.resolve([] as ClientSummaryBalanceRecord[]),
    ]);

    const accountName = nameRecords[0]?.Name ?? null;

    // Latest balance per FA
    const latestBalanceMap = new Map<string, number>();
    for (const b of balances) {
      if (!latestBalanceMap.has(b.FinancialAccountId)) {
        latestBalanceMap.set(b.FinancialAccountId, b.Amount ?? 0);
      }
    }

    // Build FA ID → Type map from the FA records
    const faTypeMap = new Map<string, string>();
    for (let i = 0; i < faIds.length && i < faTypes.length; i++) {
      faTypeMap.set(faIds[i], faTypes[i].Type ?? "Other");
    }

    // Group by type — count from FA records, balance from FinancialAccountBalance
    const byType = new Map<string, { count: number; total: number }>();
    for (const r of faTypes) {
      const type = r.Type ?? "Other";
      const entry = byType.get(type) ?? { count: 0, total: 0 };
      entry.count += 1;
      byType.set(type, entry);
    }
    for (const [faId, balance] of latestBalanceMap.entries()) {
      const type = faTypeMap.get(faId) ?? "Other";
      const entry = byType.get(type);
      if (entry) entry.total += balance;
    }

    const financialAccountsByType: FinancialTypeSummary[] = [...byType.entries()]
      .map(([type, { count, total }]) => ({ type, count, totalBalance: total }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    const totalFinancialBalance = [...latestBalanceMap.values()].reduce((s, v) => s + v, 0);

    const data: ClientSummaryData = {
      accountId: input.account_id,
      accountName,
      financialAccountsByType,
      totalFinancialBalance,
    };

    const divider = "─".repeat(40);
    const lines = [
      `Client Financial Summary: ${accountName ?? input.account_id}`,
      divider,
      "",
      "FINANCIAL ACCOUNTS",
      divider,
      `Total Balance: ${formatCurrency(totalFinancialBalance)}`,
    ];

    if (financialAccountsByType.length === 0) {
      lines.push("  No financial accounts found.");
    } else {
      for (const t of financialAccountsByType) {
        lines.push(`  ${t.type.padEnd(24)} ${t.count} account(s)  |  ${formatCurrency(t.totalBalance)}`);
      }
    }

    console.error('[financial] sf_get_client_summary RESULT types:', data.financialAccountsByType.length, '| totalBalance:', data.totalFinancialBalance);
    return { text: lines.join("\n"), data };
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error('[financial] sf_get_client_summary ERROR:');
    console.error('[financial]   message:', e?.message);
    console.error('[financial]   errorCode:', e?.errorCode);
    console.error('[financial]   name:', e?.name);
    console.error('[financial]   body:', typeof e?.body === 'string' ? e.body : JSON.stringify(e?.body));
    console.error('[financial]   full:', JSON.stringify(err));
    throw new Error(`sf_get_client_summary failed: ${toMcpError(err)}`);
  }
}

// ── sf_get_financial_account_roles ────────────────────────────────────────

export const getFinancialAccountRolesSchema = z.object({
  financial_account_id: z
    .string()
    .min(1)
    .describe("Financial Account record ID"),
});

export type GetFinancialAccountRolesInput = z.infer<typeof getFinancialAccountRolesSchema>;

interface FinancialAccountPartyRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  FinancialAccountId: string;
  AccountId: string | null;
  ContactId: string | null;
  Role: string | null;
  IsRoleActive: boolean;
  RoleStartDate: string | null;
  RoleEndDate: string | null;
}

export interface FinancialAccountRole {
  id: string;
  name: string;
  financialAccountId: string;
  accountId: string | null;
  contactId: string | null;
  role: string | null;
  isRoleActive: boolean;
  roleStartDate: string | null;
  roleEndDate: string | null;
}

export async function getFinancialAccountRoles(
  input: GetFinancialAccountRolesInput
): Promise<{ text: string; data: FinancialAccountRole[] }> {
  console.error('[financial] ═══════════════════════════════');
  console.error('[financial] sf_get_financial_account_roles INVOKED');
  console.error('[financial] args:', JSON.stringify(input));
  const safe = input.financial_account_id.replace(/'/g, "\\'");

  const soql = `
    SELECT Id, Name,
      FinancialAccountId,
      AccountId,
      ContactId,
      Role, IsRoleActive,
      RoleStartDate, RoleEndDate
    FROM FinancialAccountParty
    WHERE FinancialAccountId = '${safe}'
      AND IsRoleActive = true
  `.trim();

  try {
    const records = await query<FinancialAccountPartyRecord>(soql);

    const data: FinancialAccountRole[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      financialAccountId: r.FinancialAccountId,
      accountId: r.AccountId,
      contactId: r.ContactId,
      role: r.Role,
      isRoleActive: r.IsRoleActive,
      roleStartDate: r.RoleStartDate,
      roleEndDate: r.RoleEndDate,
    }));

    const header = `Found ${data.length} active party role(s) for financial account:\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      return [
        `${i + 1}. ${r.name}`,
        `   Role: ${r.role ?? "N/A"}`,
      ].join("\n");
    });

    console.error('[financial] sf_get_financial_account_roles RESULT count:', data.length);
    return { text: `${header}\n\n${body}`, data };
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error('[financial] sf_get_financial_account_roles ERROR:');
    console.error('[financial]   message:', e?.message);
    console.error('[financial]   errorCode:', e?.errorCode);
    console.error('[financial]   name:', e?.name);
    console.error('[financial]   body:', typeof e?.body === 'string' ? e.body : JSON.stringify(e?.body));
    console.error('[financial]   full:', JSON.stringify(err));
    throw new Error(`sf_get_financial_account_roles failed: ${toMcpError(err)}`);
  }
}

// ── sf_get_account_relationships ──────────────────────────────────────────

export const getAccountRelationshipsSchema = z.object({
  account_id: z
    .string()
    .min(1)
    .describe("Salesforce Account ID"),
});

export type GetAccountRelationshipsInput = z.infer<typeof getAccountRelationshipsSchema>;

interface AccountAccountRelationRecord extends SFQueryRecord {
  Id: string;
  AccountId: string;
  Account: { Name: string } | null;
  RelatedAccountId: string;
  RelatedAccount: { Name: string } | null;
  IsActive: boolean;
  HierarchyType: string | null;
  StartDate: string | null;
  EndDate: string | null;
  PartyRoleRelationId: string | null;
}

export interface AccountRelationship {
  id: string;
  accountId: string;
  accountName: string | null;
  relatedAccountId: string;
  relatedAccountName: string | null;
  hierarchyType: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  partyRoleRelationId: string | null;
}

export async function getAccountRelationships(
  input: GetAccountRelationshipsInput
): Promise<{ text: string; data: AccountRelationship[] }> {
  console.error('[financial] ═══════════════════════════════');
  console.error('[financial] sf_get_account_relationships INVOKED');
  console.error('[financial] args:', JSON.stringify(input));
  const safe = input.account_id.replace(/'/g, "\\'");

  const soql = `
    SELECT Id,
      AccountId, Account.Name,
      RelatedAccountId, RelatedAccount.Name,
      IsActive,
      HierarchyType,
      StartDate, EndDate,
      PartyRoleRelationId
    FROM AccountAccountRelation
    WHERE (AccountId = '${safe}' OR RelatedAccountId = '${safe}')
      AND IsActive = true
  `.trim();

  try {
    const records = await query<AccountAccountRelationRecord>(soql);

    const data: AccountRelationship[] = records.map((r) => ({
      id: r.Id,
      accountId: r.AccountId,
      accountName: r.Account?.Name ?? null,
      relatedAccountId: r.RelatedAccountId,
      relatedAccountName: r.RelatedAccount?.Name ?? null,
      hierarchyType: r.HierarchyType,
      isActive: r.IsActive,
      startDate: r.StartDate,
      endDate: r.EndDate,
      partyRoleRelationId: r.PartyRoleRelationId,
    }));

    const header = `Found ${data.length} active relationship(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      const otherName = r.accountId === input.account_id
        ? (r.relatedAccountName ?? r.relatedAccountId)
        : (r.accountName ?? r.accountId);
      return [
        `${i + 1}. ${otherName}`,
        `   Type: ${r.hierarchyType ?? "N/A"}`,
        ...(r.startDate ? [`   Since: ${formatDate(r.startDate)}`] : []),
      ].join("\n");
    });

    console.error('[financial] sf_get_account_relationships RESULT count:', data.length);
    return { text: `${header}\n\n${body}`, data };
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error('[financial] sf_get_account_relationships ERROR:');
    console.error('[financial]   message:', e?.message);
    console.error('[financial]   errorCode:', e?.errorCode);
    console.error('[financial]   name:', e?.name);
    console.error('[financial]   body:', typeof e?.body === 'string' ? e.body : JSON.stringify(e?.body));
    console.error('[financial]   full:', JSON.stringify(err));
    throw new Error(`sf_get_account_relationships failed: ${toMcpError(err)}`);
  }
}
