// Lightweight Salesforce REST API client for Next.js server components.
// Uses the user's OAuth access token from the session — Salesforce RBAC applies.

export function buildSalesforceRecordUrl(instanceUrl: string, recordId: string): string {
  return `${instanceUrl}/lightning/r/${recordId}/view`;
}

import { refreshSession } from "./token-refresh";

export const SF_API_VERSION = "v62.0";

interface QueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

async function sfFetch<T>(
  instanceUrl: string,
  accessToken: string,
  path: string
): Promise<T> {
  const res = await fetch(`${instanceUrl}/services/data/${SF_API_VERSION}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    // Don't cache SF data — always fresh
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("SF_SESSION_EXPIRED");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function sfQuery<T>(
  instanceUrl: string,
  accessToken: string,
  soql: string
): Promise<T[]> {
  const result = await sfFetch<QueryResult<T>>(
    instanceUrl,
    accessToken,
    `/query?q=${encodeURIComponent(soql)}`
  );
  return result.records;
}

/**
 * Session-aware sfQuery wrapper that transparently refreshes the token on 401
 * and retries once before rethrowing.
 */
export async function sfQueryWithRefresh<T>(
  session: import("iron-session").IronSession<import("./session-config").SessionData>,
  soql: string
): Promise<T[]> {
  try {
    return await sfQuery<T>(session.instanceUrl!, session.accessToken!, soql);
  } catch (err) {
    if (err instanceof Error && err.message === "SF_SESSION_EXPIRED") {
      await refreshSession(session);
      return sfQuery<T>(session.instanceUrl!, session.accessToken!, soql);
    }
    throw err;
  }
}

// ── Typed query helpers used by pages ─────────────────────────────────────

export interface SFAccount {
  Id: string;
  Name: string;
  Industry: string | null;
  AnnualRevenue: number | null;
  NumberOfEmployees: number | null;
  BillingState: string | null;
  BillingCity: string | null;
  Phone: string | null;
  Website: string | null;
  Type: string | null;
  Description: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
  LastActivityDate?: string | null;
  Owner: { Name: string } | null;
}

export interface SFOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
  Probability: number | null;
  Account?: { Name: string } | null;
}

export interface SFContact {
  Id: string;
  Name: string;
  Title: string | null;
  Email: string | null;
  Phone: string | null;
  Department: string | null;
}

export interface SFCase {
  Id: string;
  CaseNumber: string;
  Subject: string | null;
  Status: string;
  Priority: string | null;
  CreatedDate: string;
  ClosedDate: string | null;
  Description: string | null;
  Contact: { Name: string } | null;
  Owner: { Name: string } | null;
}

export interface SFPipelineStage {
  StageName: string;
  cnt: number;
  totalAmt: number | null;
}

export async function listAccounts(
  instanceUrl: string,
  accessToken: string,
  limit = 50,
  offset = 0
): Promise<SFAccount[]> {
  const fullSoql = `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, BillingCity, BillingState, Type
     FROM Account ORDER BY Name ASC LIMIT ${limit} OFFSET ${offset}`;
  try {
    return await sfQuery<SFAccount>(instanceUrl, accessToken, fullSoql);
  } catch (err) {
    const body = err instanceof Error ? err.message : String(err);
    if (body.includes("INVALID_FIELD")) {
      console.warn(
        "[listAccounts] INVALID_FIELD on full field set — retrying with narrow fields. Error:",
        body
      );
      return sfQuery<SFAccount>(
        instanceUrl,
        accessToken,
        `SELECT Id, Name, AnnualRevenue FROM Account ORDER BY AnnualRevenue DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`
      );
    }
    throw err;
  }
}

export async function getAccountCount(
  instanceUrl: string,
  accessToken: string
): Promise<number> {
  const result = await sfFetch<{ totalSize: number }>(
    instanceUrl,
    accessToken,
    `/query?q=${encodeURIComponent("SELECT COUNT() FROM Account")}`
  );
  return result.totalSize;
}

// ── Paginated accounts query ───────────────────────────────────────────────

function escapeSOQL(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\r\n]/g, " ");
}

export type AccountSortBy = "name-asc" | "revenue-desc" | "last-activity-desc";

export interface AccountQueryOptions {
  pageSize?: number;
  afterName?: string;
  offset?: number;
  industry?: string;
  search?: string;
  sortBy?: AccountSortBy;
}

export interface AccountQueryResult {
  accounts: SFAccount[];
  hasMore: boolean;
  totalCount: number;
}

export async function queryAccounts(
  instanceUrl: string,
  accessToken: string,
  options: AccountQueryOptions = {}
): Promise<AccountQueryResult> {
  const { pageSize = 200, afterName, offset = 0, industry, search, sortBy = "name-asc" } = options;

  const whereClauses: string[] = [];

  if (industry && industry !== "all") {
    whereClauses.push(`Industry = '${escapeSOQL(industry)}'`);
  }

  if (search?.trim()) {
    const term = escapeSOQL(search.trim());
    whereClauses.push(`(Name LIKE '%${term}%' OR BillingCity LIKE '%${term}%' OR Industry LIKE '%${term}%')`);
  }

  if (afterName && sortBy === "name-asc") {
    whereClauses.push(`Name > '${escapeSOQL(afterName)}'`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  let orderBy: string;
  switch (sortBy) {
    case "revenue-desc":
      orderBy = "ORDER BY AnnualRevenue DESC NULLS LAST, Id ASC";
      break;
    case "last-activity-desc":
      orderBy = "ORDER BY LastActivityDate DESC NULLS LAST, Id ASC";
      break;
    default:
      orderBy = "ORDER BY Name ASC, Id ASC";
  }

  const offsetClause = sortBy !== "name-asc" && offset > 0 ? `OFFSET ${offset}` : "";

  const dataQuery = [
    "SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees,",
    "BillingCity, BillingState, LastActivityDate",
    "FROM Account",
    whereSql,
    orderBy,
    `LIMIT ${pageSize + 1}`,
    offsetClause,
  ].filter(Boolean).join(" ");

  const countQuery = `SELECT COUNT() FROM Account ${whereSql}`.trim();

  const [dataResult, countResult] = await Promise.all([
    sfFetch<{ totalSize: number; records: SFAccount[] }>(
      instanceUrl, accessToken, `/query?q=${encodeURIComponent(dataQuery)}`
    ),
    sfFetch<{ totalSize: number; records: [] }>(
      instanceUrl, accessToken, `/query?q=${encodeURIComponent(countQuery)}`
    ),
  ]);

  const records = dataResult.records.slice(0, pageSize);
  const hasMore = dataResult.records.length > pageSize;

  return { accounts: records, hasMore, totalCount: countResult.totalSize };
}

export async function getAccountIndustries(
  instanceUrl: string,
  accessToken: string
): Promise<string[]> {
  try {
    const result = await sfFetch<{ totalSize: number; records: Array<{ Industry: string }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent("SELECT Industry FROM Account WHERE Industry != null GROUP BY Industry ORDER BY Industry ASC")}`
    );
    return result.records.map((r) => r.Industry).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getAccount(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFAccount | null> {
  const safe = accountId.replace(/['"\\]/g, "");
  const records = await sfQuery<SFAccount>(
    instanceUrl,
    accessToken,
    `SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees,
            Phone, Website, BillingState, BillingCity, Description,
            CreatedDate, LastModifiedDate, Owner.Name
     FROM Account WHERE Id = '${safe}' LIMIT 1`
  );
  return records[0] ?? null;
}

export async function getAccountOpportunities(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFOpportunity[]> {
  const safe = accountId.replace(/['"\\]/g, "");
  return sfQuery<SFOpportunity>(
    instanceUrl,
    accessToken,
    `SELECT Id, Name, StageName, Amount, CloseDate, Probability
     FROM Opportunity WHERE AccountId = '${safe}' ORDER BY CloseDate ASC LIMIT 10`
  );
}

export async function getAccountContacts(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFContact[]> {
  const safe = accountId.replace(/['"\\]/g, "");
  return sfQuery<SFContact>(
    instanceUrl,
    accessToken,
    `SELECT Id, Name, Title, Email, Phone, Department
     FROM Contact WHERE AccountId = '${safe}' ORDER BY Name ASC LIMIT 10`
  );
}

export async function getAccountCases(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFCase[]> {
  const safe = accountId.replace(/['"\\]/g, "");
  return sfQuery<SFCase>(
    instanceUrl,
    accessToken,
    `SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate,
            ClosedDate, Description, Contact.Name, Owner.Name
     FROM Case WHERE AccountId = '${safe}' ORDER BY CreatedDate DESC LIMIT 20`
  );
}

export async function getPipelineSummary(
  instanceUrl: string,
  accessToken: string
): Promise<SFPipelineStage[]> {
  return sfQuery<SFPipelineStage>(
    instanceUrl,
    accessToken,
    `SELECT StageName, COUNT(Id) cnt, SUM(Amount) totalAmt
     FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY StageName`
  );
}

export async function getTopAccountsByRevenue(
  instanceUrl: string,
  accessToken: string,
  limit = 5
): Promise<SFAccount[]> {
  return sfQuery<SFAccount>(
    instanceUrl,
    accessToken,
    `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, BillingCity, BillingState, Type
     FROM Account WHERE AnnualRevenue != null ORDER BY AnnualRevenue DESC LIMIT ${limit}`
  );
}

export interface SFRecentItem {
  Id: string;
  Name: string;
  LastModifiedDate: string;
  objectType: "Account" | "Opportunity";
  detail: string | null;
}

export async function getRecentActivity(
  instanceUrl: string,
  accessToken: string
): Promise<SFRecentItem[]> {
  interface RawAccount {
    Id: string;
    Name: string;
    LastModifiedDate: string;
    Industry: string | null;
  }
  interface RawOpportunity {
    Id: string;
    Name: string;
    LastModifiedDate: string;
    StageName: string;
  }

  const [accts, opps] = await Promise.allSettled([
    sfQuery<RawAccount>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, LastModifiedDate, Industry FROM Account ORDER BY LastModifiedDate DESC LIMIT 5`
    ),
    sfQuery<RawOpportunity>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, LastModifiedDate, StageName FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 5`
    ),
  ]);

  const accountItems: SFRecentItem[] =
    accts.status === "fulfilled"
      ? accts.value.map((a) => ({
          Id: a.Id,
          Name: a.Name,
          LastModifiedDate: a.LastModifiedDate,
          objectType: "Account" as const,
          detail: a.Industry,
        }))
      : [];

  const oppItems: SFRecentItem[] =
    opps.status === "fulfilled"
      ? opps.value.map((o) => ({
          Id: o.Id,
          Name: o.Name,
          LastModifiedDate: o.LastModifiedDate,
          objectType: "Opportunity" as const,
          detail: o.StageName,
        }))
      : [];

  return [...accountItems, ...oppItems]
    .sort((a, b) => new Date(b.LastModifiedDate).getTime() - new Date(a.LastModifiedDate).getTime())
    .slice(0, 8);
}

export interface SFWinLossStats {
  closedWon: number;
  closedLost: number;
  winRate: number; // 0–100
  avgDealSize: number | null;
}

export async function getWinLossStats(
  instanceUrl: string,
  accessToken: string
): Promise<SFWinLossStats> {
  interface WinLossRow {
    IsWon: boolean;
    cnt: number;
    avgAmt: number | null;
  }

  const rows = await sfQuery<WinLossRow>(
    instanceUrl,
    accessToken,
    `SELECT IsWon, COUNT(Id) cnt, AVG(Amount) avgAmt
     FROM Opportunity WHERE IsClosed = true GROUP BY IsWon`
  ).catch(() => [] as WinLossRow[]);

  const wonRow = rows.find((r) => r.IsWon === true);
  const lostRow = rows.find((r) => r.IsWon === false);
  const won = wonRow?.cnt ?? 0;
  const lost = lostRow?.cnt ?? 0;
  const total = won + lost;

  return {
    closedWon: won,
    closedLost: lost,
    winRate: total > 0 ? Math.round((won / total) * 100) : 0,
    avgDealSize: wonRow?.avgAmt ?? null,
  };
}

export interface SFFinancialAccount {
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

export async function getFinancialAccounts(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFFinancialAccount[]> {
  const safe = accountId.replace(/['"\\]/g, "");
  try {
    const parties = await sfQuery<{ FinancialAccountId: string }>(
      instanceUrl,
      accessToken,
      `SELECT FinancialAccountId FROM FinancialAccountParty WHERE AccountId = '${safe}' AND Role = 'Owner' AND IsRoleActive = true`
    );
    if (parties.length === 0) return [];
    const idsClause = parties.map((p) => `'${escapeSOQL(p.FinancialAccountId)}'`).join(",");
    return await sfQuery<SFFinancialAccount>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinancialAccountNumber, Type, Status,
              OpeningDate, ClosingDate, InterestRate, InterestType,
              TotalOutstandingAmount, PrincipalAmount, AmountDue, PaymentDueDate,
              CreditLimit, MaturityDate, IsOverdraftAllowed, IsHeldAway
       FROM FinancialAccount
       WHERE Id IN (${idsClause})`
    );
  } catch {
    return [];
  }
}

export interface SFFinancialAccountRole {
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

export async function getFinancialAccountRoles(
  instanceUrl: string,
  accessToken: string,
  financialAccountId: string
): Promise<SFFinancialAccountRole[]> {
  const safe = financialAccountId.replace(/['"\\]/g, "");
  try {
    return await sfQuery<SFFinancialAccountRole>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name,
              FinancialAccountId,
              AccountId, ContactId,
              Role, IsRoleActive,
              RoleStartDate, RoleEndDate
       FROM FinancialAccountParty
       WHERE FinancialAccountId = '${safe}'
         AND IsRoleActive = true`
    );
  } catch {
    return [];
  }
}

export interface SFAccountRelationship {
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

export async function getAccountRelationships(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFAccountRelationship[]> {
  const safe = accountId.replace(/['"\\]/g, "");
  try {
    return await sfQuery<SFAccountRelationship>(
      instanceUrl,
      accessToken,
      `SELECT Id,
              AccountId, Account.Name,
              RelatedAccountId, RelatedAccount.Name,
              IsActive, HierarchyType,
              StartDate, EndDate,
              PartyRoleRelationId
       FROM AccountAccountRelation
       WHERE (AccountId = '${safe}' OR RelatedAccountId = '${safe}')
         AND IsActive = true`
    );
  } catch {
    return [];
  }
}

// ── Task queries ───────────────────────────────────────────────────────────

export interface SFTask {
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

const TASK_FIELDS = `
  SELECT Id, Subject, Status, Priority,
    ActivityDate, Description,
    WhatId, What.Name,
    WhoId, Who.Name,
    CreatedDate, Owner.Name
  FROM Task
`;

export async function getNewsAlerts(
  instanceUrl: string,
  accessToken: string,
  accountId?: string
): Promise<SFTask[]> {
  const safe = accountId?.replace(/['"\\]/g, "");
  const accountFilter = safe ? `AND WhatId = '${safe}'` : "";
  return sfQuery<SFTask>(
    instanceUrl,
    accessToken,
    `${TASK_FIELDS}
     WHERE Subject LIKE 'News Alert:%'
     AND Status != 'Completed'
     ${accountFilter}
     ORDER BY CreatedDate DESC
     LIMIT 20`
  );
}

export async function getRecentTasks(
  instanceUrl: string,
  accessToken: string,
  accountId?: string
): Promise<SFTask[]> {
  const safe = accountId?.replace(/['"\\]/g, "");
  const accountFilter = safe ? `AND WhatId = '${safe}'` : "";
  return sfQuery<SFTask>(
    instanceUrl,
    accessToken,
    `${TASK_FIELDS}
     WHERE Subject NOT LIKE 'News Alert:%'
     ${accountFilter}
     ORDER BY CreatedDate DESC
     LIMIT 20`
  );
}

// ── Dashboard KPI helpers ──────────────────────────────────────────────────

export interface SFDashboardKpis {
  accountsOwned: number;
  openPipelineAmount: number | null;
  openDealsCount: number;
  winRate: number; // 0–100
  avgWonDealSize: number | null;
  openCasesCount: number;
}

export async function getDashboardKpis(
  instanceUrl: string,
  accessToken: string,
  userId: string
): Promise<SFDashboardKpis> {
  const safe = userId.replace(/['"\\]/g, "");

  const [
    accountsResult,
    pipelineResult,
    openDealsResult,
    winLossResult,
    avgWonResult,
    casesResult,
  ] = await Promise.all([
    sfFetch<{ totalSize: number; done: boolean; records: Array<{ cnt: number }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent(`SELECT COUNT(Id) cnt FROM Account WHERE OwnerId = '${safe}'`)}`
    ).catch(() => null),

    sfFetch<{ totalSize: number; done: boolean; records: Array<{ totalAmt: number | null }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent(`SELECT SUM(Amount) totalAmt FROM Opportunity WHERE IsClosed = false AND OwnerId = '${safe}'`)}`
    ).catch(() => null),

    sfFetch<{ totalSize: number; done: boolean; records: Array<{ cnt: number }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent(`SELECT COUNT(Id) cnt FROM Opportunity WHERE IsClosed = false AND OwnerId = '${safe}'`)}`
    ).catch(() => null),

    sfFetch<{ totalSize: number; done: boolean; records: Array<{ IsWon: boolean; cnt: number }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent(`SELECT IsWon, COUNT(Id) cnt FROM Opportunity WHERE IsClosed = true AND OwnerId = '${safe}' GROUP BY IsWon`)}`
    ).catch(() => null),

    sfFetch<{ totalSize: number; done: boolean; records: Array<{ avgAmt: number | null }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent(`SELECT AVG(Amount) avgAmt FROM Opportunity WHERE IsClosed = true AND StageName = 'Closed Won' AND OwnerId = '${safe}'`)}`
    ).catch(() => null),

    sfFetch<{ totalSize: number; done: boolean; records: Array<{ cnt: number }> }>(
      instanceUrl,
      accessToken,
      `/query?q=${encodeURIComponent(`SELECT COUNT(Id) cnt FROM Case WHERE Status != 'Closed' AND OwnerId = '${safe}'`)}`
    ).catch(() => null),
  ]);

  const wonRow = winLossResult?.records.find((r) => r.IsWon === true);
  const lostRow = winLossResult?.records.find((r) => r.IsWon === false);
  const won = wonRow?.cnt ?? 0;
  const lost = lostRow?.cnt ?? 0;
  const total = won + lost;

  return {
    accountsOwned: accountsResult?.records[0]?.cnt ?? 0,
    openPipelineAmount: pipelineResult?.records[0]?.totalAmt ?? null,
    openDealsCount: openDealsResult?.records[0]?.cnt ?? 0,
    winRate: total > 0 ? Math.round((won / total) * 100) : 0,
    avgWonDealSize: avgWonResult?.records[0]?.avgAmt ?? null,
    openCasesCount: casesResult?.records[0]?.cnt ?? 0,
  };
}

// ── FSC Core: Financial Accounts ──────────────────────────────────────────

import type {
  FinancialAccount,
  FinancialAccountBalance,
  FinancialAccountParty,
  FinancialAccountWithRole,
  FinancialAccountTransaction,
} from "./financial-accounts";

/**
 * Returns financial accounts where the given Account is an active party,
 * joined with the role that account holds on each one.
 */
export async function getFinancialAccountsForAccount(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<FinancialAccountWithRole[]> {
  const safe = escapeSOQL(accountId);

  let parties: FinancialAccountParty[];
  try {
    parties = await sfQuery<FinancialAccountParty>(
      instanceUrl,
      accessToken,
      `SELECT Id, FinancialAccountId, Role, RoleStartDate, RoleEndDate, IsRoleActive, AccountId, ContactId FROM FinancialAccountParty WHERE AccountId = '${safe}' AND IsRoleActive = true ORDER BY Role ASC`
    );
  } catch (err) {
    console.error("[getFinancialAccountsForAccount] parties query failed:", err);
    return [];
  }

  if (parties.length === 0) return [];

  const idsClause = parties.map((p) => `'${escapeSOQL(p.FinancialAccountId)}'`).join(",");

  let accounts: FinancialAccount[];
  try {
    accounts = await sfQuery<FinancialAccount>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinancialAccountNumber, Type, Status, OpeningDate, ClosingDate, MaturityDate, RenewalDate, PaymentDueDate, PrincipalAmount, TotalOutstandingAmount, AmountDue, InterestRate, InterestType, DownPaymentAmount, Term, CreditLimit, PrincipalPaidYearToDate, InterestPaidYearToDate, IsOverdraftAllowed, IsManaged, BankerId, BranchUnitId, ProductId, CurrencyIsoCode FROM FinancialAccount WHERE Id IN (${idsClause}) ORDER BY Type ASC, Name ASC`
    );
  } catch (err) {
    console.error("[getFinancialAccountsForAccount] accounts query failed:", err);
    return [];
  }

  let balances: FinancialAccountBalance[] = [];
  try {
    balances = await sfQuery<FinancialAccountBalance>(
      instanceUrl,
      accessToken,
      `SELECT Id, FinancialAccountId, Amount, Type, BalanceAsOfDate, SystemModstamp FROM FinancialAccountBalance WHERE FinancialAccountId IN (${idsClause}) AND Type = 'Total Balance' ORDER BY BalanceAsOfDate DESC NULLS LAST, SystemModstamp DESC`
    );
  } catch (err) {
    console.error("[getFinancialAccountsForAccount] balances query failed:", err);
  }

  const latestBalanceByFAId = new Map<string, FinancialAccountBalance>();
  for (const bal of balances) {
    if (!latestBalanceByFAId.has(bal.FinancialAccountId)) {
      latestBalanceByFAId.set(bal.FinancialAccountId, bal);
    }
  }

  const partyByFAId = new Map(parties.map((p) => [p.FinancialAccountId, p]));
  return accounts.map((fa) => {
    const bal = latestBalanceByFAId.get(fa.Id);
    return {
      ...fa,
      Role: partyByFAId.get(fa.Id)?.Role ?? "Unknown",
      PartyId: partyByFAId.get(fa.Id)?.Id ?? "",
      CurrentBalance: bal?.Amount ?? null,
      BalanceAsOfDate: bal?.BalanceAsOfDate ?? null,
    };
  });
}

/**
 * Returns the most recent Total Balance record for a single financial account.
 */
export async function getFinancialAccountBalance(
  instanceUrl: string,
  accessToken: string,
  financialAccountId: string
): Promise<FinancialAccountBalance | null> {
  const safe = escapeSOQL(financialAccountId);
  try {
    const rows = await sfQuery<FinancialAccountBalance>(
      instanceUrl,
      accessToken,
      `SELECT Id, FinancialAccountId, Amount, Type, BalanceAsOfDate, CurrencyIsoCode FROM FinancialAccountBalance WHERE FinancialAccountId = '${safe}' AND Type = 'Total Balance' ORDER BY BalanceAsOfDate DESC NULLS LAST, SystemModstamp DESC LIMIT 1`
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ── Salesforce Models API (Einstein Trust Layer) ─────────────────────────

export interface SfModelsChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SfModelsChatResult {
  text: string;
}

async function getModelsAccessToken(): Promise<string> {
  const tokenUrl = `${process.env.SF_LOGIN_URL?.replace(/\/$/, "")}/services/oauth2/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SF_MODELS_CLIENT_ID!,
      client_secret: process.env.SF_MODELS_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Models API auth failed (${res.status}): ${errBody}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Sends a chat conversation to the Salesforce Models API (chat-generations
 * endpoint) via the api.salesforce.com gateway using a dedicated Client
 * Credentials token. The request routes through Einstein Trust Layer.
 *
 * @param messages      The conversation so far
 * @param modelApiName  The sfdc_ai__ API name from the Models catalog
 */
export async function sfModelsChat(
  messages: SfModelsChatMessage[],
  modelApiName: string,
): Promise<SfModelsChatResult> {
  // Bedrock (via Models API) rejects empty-content messages. Filter them out
  // and enforce valid turn order before the request leaves this function.
  const filtered = messages
    .map((m) => ({ role: m.role, content: m.content?.trim() ?? "" }))
    .filter((m) => m.content.length > 0);

  // Must end with a user turn.
  while (filtered.length > 0 && filtered[filtered.length - 1].role === "assistant") {
    filtered.pop();
  }
  // Must not start with an assistant turn.
  while (filtered.length > 0 && filtered[0].role === "assistant") {
    filtered.shift();
  }

  if (filtered.length === 0) {
    throw new Error("No valid messages to send to Salesforce Models API");
  }

  const accessToken = await getModelsAccessToken();
  const url =
    `https://api.salesforce.com/einstein/platform/v1/models/` +
    `${encodeURIComponent(modelApiName)}/chat-generations`;

  console.log('[sf-models] === REQUEST ===');
  console.log('URL:', url);
  console.log('Model:', modelApiName);
  console.log('Token (first 50 chars):', accessToken.substring(0, 50));
  console.log('Body messages count:', filtered.length);
  console.log('Body roles:', filtered.map((m) => m.role).join(','));
  console.log('Body last message:', JSON.stringify(filtered[filtered.length - 1], null, 2));
  console.log('[sf-models] === END REQUEST ===');

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json;charset=utf-8",
      "x-sfdc-app-context": "EinsteinGPT",
      "x-client-feature-id": "ai-platform-models-connected-app",
    },
    body: JSON.stringify({
      messages: filtered,
      tags: {},
    }),
    cache: "no-store",
  });

  const responseText = await res.text();

  console.log('[sf-models] === RESPONSE ===');
  console.log('Status:', res.status, res.statusText);
  console.log('OK:', res.ok);
  console.log('Body:', responseText);
  console.log('[sf-models] === END RESPONSE ===');

  if (!res.ok) {
    throw new Error(`Salesforce Models API error ${res.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText) as {
    generationDetails?: { generations?: Array<{ content?: string; role?: string }> };
    generations?: Array<{ text?: string; content?: string }>;
    choices?: Array<{ message?: { content?: string } }>;
  };

  const generations = data.generationDetails?.generations ?? [];
  const text =
    generations.map((g) => g.content ?? "").filter((s) => s.length > 0).join("\n\n") ||
    (data.generations?.[0]?.text ??
    data.generations?.[0]?.content ??
    data.choices?.[0]?.message?.content ??
    "");

  console.log('[sf-models] === EXTRACTED ===');
  console.log('Generations count:', generations.length);
  console.log('Extracted text:', text);
  console.log('Text length:', text.length);
  console.log('[sf-models] === END EXTRACTED ===');

  return { text: text || "(Models API returned no text.)" };
}

/**
 * Returns the most recent transactions for a single financial account.
 */
export async function getTransactionsForFinancialAccount(
  instanceUrl: string,
  accessToken: string,
  financialAccountId: string,
  limit = 25
): Promise<FinancialAccountTransaction[]> {
  const safe = escapeSOQL(financialAccountId);
  try {
    return await sfQuery<FinancialAccountTransaction>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinancialAccountId, Amount, DebitCreditIndicator, TransactionDate, PostedDate, Description, TransactionCode, Type, SubType, Status FROM FinancialAccountTransaction WHERE FinancialAccountId = '${safe}' ORDER BY TransactionDate DESC NULLS LAST, PostedDate DESC NULLS LAST LIMIT ${limit}`
    );
  } catch {
    return [];
  }
}
