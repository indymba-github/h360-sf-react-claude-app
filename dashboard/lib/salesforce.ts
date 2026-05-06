// Lightweight Salesforce REST API client for Next.js server components.
// Uses the user's OAuth access token from the session — Salesforce RBAC applies.

const SF_API_VERSION = "v59.0";

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
  limit = 25
): Promise<SFAccount[]> {
  return sfQuery<SFAccount>(
    instanceUrl,
    accessToken,
    `SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, BillingCity, BillingState, Type
     FROM Account ORDER BY Name ASC LIMIT ${limit}`
  );
}

export async function getAccount(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFAccount | null> {
  const safe = accountId.replace(/'/g, "\\'");
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
  const safe = accountId.replace(/'/g, "\\'");
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
  const safe = accountId.replace(/'/g, "\\'");
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
  const safe = accountId.replace(/'/g, "\\'");
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
  FinServ__FinancialAccountNumber__c: string | null;
  FinServ__FinancialAccountType__c: string | null;
  FinServ__Status__c: string | null;
  FinServ__Balance__c: number | null;
  FinServ__InterestRate__c: number | null;
  FinServ__APY__c: number | null;
  FinServ__OpenDate__c: string | null;
  FinServ__LoanAmount__c: number | null;
  FinServ__PrincipalBalance__c: number | null;
  FinServ__PaymentAmount__c: number | null;
  FinServ__PaymentDueDate__c: string | null;
  FinServ__Nickname__c: string | null;
  FinServ__HoldingCount__c: number | null;
  RecordType: { Name: string } | null;
}

export async function getFinancialAccounts(
  instanceUrl: string,
  accessToken: string,
  accountId: string
): Promise<SFFinancialAccount[]> {
  const safe = accountId.replace(/'/g, "\\'");
  try {
    return await sfQuery<SFFinancialAccount>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinServ__FinancialAccountNumber__c, FinServ__FinancialAccountType__c,
              FinServ__Status__c, FinServ__Balance__c, FinServ__InterestRate__c, FinServ__APY__c,
              FinServ__OpenDate__c, FinServ__LoanAmount__c, FinServ__PrincipalBalance__c,
              FinServ__PaymentAmount__c, FinServ__PaymentDueDate__c, FinServ__Nickname__c,
              FinServ__HoldingCount__c, RecordType.Name
       FROM FinServ__FinancialAccount__c
       WHERE FinServ__PrimaryOwner__c = '${safe}'
       ORDER BY FinServ__Balance__c DESC NULLS LAST`
    );
  } catch {
    return [];
  }
}

export interface SFFinancialAccountRole {
  Id: string;
  Name: string;
  FinServ__Role__c: string | null;
  FinServ__Active__c: boolean;
  FinServ__RelatedAccount__c: string | null;
  FinServ__RelatedAccount__r: { Name: string } | null;
  FinServ__RelatedContact__c: string | null;
  FinServ__RelatedContact__r: { Name: string } | null;
}

export async function getFinancialAccountRoles(
  instanceUrl: string,
  accessToken: string,
  financialAccountId: string
): Promise<SFFinancialAccountRole[]> {
  const safe = financialAccountId.replace(/'/g, "\\'");
  try {
    return await sfQuery<SFFinancialAccountRole>(
      instanceUrl,
      accessToken,
      `SELECT Id, Name, FinServ__Role__c,
              FinServ__RelatedAccount__c, FinServ__RelatedAccount__r.Name,
              FinServ__RelatedContact__c, FinServ__RelatedContact__r.Name,
              FinServ__Active__c
       FROM FinServ__FinancialAccountRole__c
       WHERE FinServ__FinancialAccount__c = '${safe}'
       AND FinServ__Active__c = true`
    );
  } catch {
    return [];
  }
}
