import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { formatCurrency, formatPercent, formatDate, formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

// ── sf_get_financial_accounts ─────────────────────────────────────────────

export const getFinancialAccountsSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Salesforce Account ID of the primary owner. If omitted, returns all."),
  account_type: z
    .string()
    .optional()
    .describe("Filter by FinServ__FinancialAccountType__c (e.g. 'Checking', 'Savings', 'Investment', 'Loan')"),
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
  FinServ__FinancialAccountNumber__c: string | null;
  FinServ__FinancialAccountType__c: string | null;
  FinServ__Status__c: string | null;
  FinServ__Balance__c: number | null;
  FinServ__AvailableCredit__c: number | null;
  FinServ__InterestRate__c: number | null;
  FinServ__APY__c: number | null;
  FinServ__OpenDate__c: string | null;
  FinServ__CloseDate__c: string | null;
  FinServ__LoanAmount__c: number | null;
  FinServ__PrincipalBalance__c: number | null;
  FinServ__PaymentAmount__c: number | null;
  FinServ__PaymentDueDate__c: string | null;
  FinServ__PaymentFrequency__c: string | null;
  FinServ__PerformanceYTD__c: number | null;
  FinServ__Performance1Yr__c: number | null;
  FinServ__HoldingCount__c: number | null;
  FinServ__Nickname__c: string | null;
  FinServ__PrimaryOwner__c: string | null;
  FinServ__JointOwner__c: string | null;
  FinServ__Household__c: string | null;
  FinServ__Stage__c: string | null;
  RecordType: { Name: string } | null;
  FinServ__PrimaryOwner__r: { Name: string } | null;
}

export interface FinancialAccount {
  id: string;
  name: string;
  accountNumber: string | null;
  type: string | null;
  status: string | null;
  balance: number | null;
  availableCredit: number | null;
  interestRate: number | null;
  apy: number | null;
  openDate: string | null;
  closeDate: string | null;
  loanAmount: number | null;
  principalBalance: number | null;
  paymentAmount: number | null;
  paymentDueDate: string | null;
  paymentFrequency: string | null;
  performanceYTD: number | null;
  performance1Yr: number | null;
  holdingCount: number | null;
  nickname: string | null;
  primaryOwnerId: string | null;
  primaryOwnerName: string | null;
  stage: string | null;
  recordTypeName: string | null;
}

export async function getFinancialAccounts(
  input: GetFinancialAccountsInput
): Promise<{ text: string; data: FinancialAccount[] }> {
  const clauses: string[] = [];

  if (input.account_id) {
    clauses.push(`FinServ__PrimaryOwner__c = '${input.account_id.replace(/'/g, "\\'")}'`);
  }
  if (input.account_type) {
    clauses.push(`FinServ__FinancialAccountType__c = '${input.account_type.replace(/'/g, "\\'")}'`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const soql = `
    SELECT Id, Name,
      FinServ__FinancialAccountNumber__c,
      FinServ__FinancialAccountType__c,
      FinServ__Status__c,
      FinServ__Balance__c,
      FinServ__AvailableCredit__c,
      FinServ__InterestRate__c,
      FinServ__APY__c,
      FinServ__OpenDate__c,
      FinServ__CloseDate__c,
      FinServ__LoanAmount__c,
      FinServ__PrincipalBalance__c,
      FinServ__PaymentAmount__c,
      FinServ__PaymentDueDate__c,
      FinServ__PaymentFrequency__c,
      FinServ__PerformanceYTD__c,
      FinServ__Performance1Yr__c,
      FinServ__HoldingCount__c,
      FinServ__Nickname__c,
      FinServ__PrimaryOwner__c,
      FinServ__JointOwner__c,
      FinServ__Household__c,
      FinServ__Stage__c,
      RecordType.Name,
      FinServ__PrimaryOwner__r.Name
    FROM FinServ__FinancialAccount__c
    ${where}
    ORDER BY FinServ__Balance__c DESC NULLS LAST
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<FinancialAccountRecord>(soql);

    const data: FinancialAccount[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      accountNumber: r.FinServ__FinancialAccountNumber__c,
      type: r.FinServ__FinancialAccountType__c,
      status: r.FinServ__Status__c,
      balance: r.FinServ__Balance__c,
      availableCredit: r.FinServ__AvailableCredit__c,
      interestRate: r.FinServ__InterestRate__c,
      apy: r.FinServ__APY__c,
      openDate: r.FinServ__OpenDate__c,
      closeDate: r.FinServ__CloseDate__c,
      loanAmount: r.FinServ__LoanAmount__c,
      principalBalance: r.FinServ__PrincipalBalance__c,
      paymentAmount: r.FinServ__PaymentAmount__c,
      paymentDueDate: r.FinServ__PaymentDueDate__c,
      paymentFrequency: r.FinServ__PaymentFrequency__c,
      performanceYTD: r.FinServ__PerformanceYTD__c,
      performance1Yr: r.FinServ__Performance1Yr__c,
      holdingCount: r.FinServ__HoldingCount__c,
      nickname: r.FinServ__Nickname__c,
      primaryOwnerId: r.FinServ__PrimaryOwner__c,
      primaryOwnerName: r.FinServ__PrimaryOwner__r?.Name ?? null,
      stage: r.FinServ__Stage__c,
      recordTypeName: r.RecordType?.Name ?? null,
    }));

    const header = `Found ${data.length} financial account(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (a, i) => {
      const lines = [
        `${i + 1}. ${a.name}${a.nickname ? ` (${a.nickname})` : ""}`,
        `   Type: ${a.type ?? "N/A"}  |  Status: ${a.status ?? "N/A"}`,
        `   Balance: ${formatCurrency(a.balance)}`,
      ];
      if (a.availableCredit != null)
        lines.push(`   Available Credit: ${formatCurrency(a.availableCredit)}`);
      if (a.interestRate != null)
        lines.push(`   Interest Rate: ${formatPercent(a.interestRate)}`);
      if (a.apy != null)
        lines.push(`   APY: ${formatPercent(a.apy)}`);
      if (a.principalBalance != null)
        lines.push(`   Principal Balance: ${formatCurrency(a.principalBalance)}`);
      if (a.paymentAmount != null) {
        const freq = a.paymentFrequency ? ` (${a.paymentFrequency})` : "";
        lines.push(`   Payment: ${formatCurrency(a.paymentAmount)}${freq}  |  Due: ${formatDate(a.paymentDueDate)}`);
      }
      if (a.performanceYTD != null)
        lines.push(`   Perf YTD: ${formatPercent(a.performanceYTD)}  |  1Yr: ${formatPercent(a.performance1Yr)}`);
      if (a.holdingCount != null)
        lines.push(`   Holdings: ${a.holdingCount}`);
      if (a.openDate)
        lines.push(`   Opened: ${formatDate(a.openDate)}`);
      return lines.join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_get_financial_accounts failed: ${toMcpError(err)}`);
  }
}

// ── sf_get_financial_holdings ─────────────────────────────────────────────

export const getFinancialHoldingsSchema = z.object({
  financial_account_id: z
    .string()
    .min(1)
    .describe("Financial Account record ID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Records to return (1-50, default 20)"),
});

export type GetFinancialHoldingsInput = z.infer<typeof getFinancialHoldingsSchema>;

interface FinancialHoldingRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  FinServ__FinancialAccount__c: string;
  FinServ__FinancialAccount__r: { Name: string } | null;
  FinServ__Symbol__c: string | null;
  FinServ__Shares__c: number | null;
  FinServ__Price__c: number | null;
  FinServ__PurchasePrice__c: number | null;
  FinServ__MarketValue__c: number | null;
  FinServ__GainLoss__c: number | null;
  FinServ__PercentChange__c: number | null;
  FinServ__AssetClass__c: string | null;
  FinServ__AssetCategory__c: string | null;
  FinServ__AssetCategoryName__c: string | null;
  FinServ__PrimaryOwner__c: string | null;
  FinServ__PrimaryOwner__r: { Name: string } | null;
}

export interface FinancialHolding {
  id: string;
  name: string;
  financialAccountId: string;
  financialAccountName: string | null;
  symbol: string | null;
  shares: number | null;
  price: number | null;
  purchasePrice: number | null;
  marketValue: number | null;
  gainLoss: number | null;
  percentChange: number | null;
  assetClass: string | null;
  assetCategory: string | null;
  primaryOwnerName: string | null;
}

export async function getFinancialHoldings(
  input: GetFinancialHoldingsInput
): Promise<{ text: string; data: FinancialHolding[] }> {
  const safe = input.financial_account_id.replace(/'/g, "\\'");

  const soql = `
    SELECT Id, Name,
      FinServ__FinancialAccount__c,
      FinServ__FinancialAccount__r.Name,
      FinServ__Symbol__c,
      FinServ__Shares__c,
      FinServ__Price__c,
      FinServ__PurchasePrice__c,
      FinServ__MarketValue__c,
      FinServ__GainLoss__c,
      FinServ__PercentChange__c,
      FinServ__AssetClass__c,
      FinServ__AssetCategory__c,
      FinServ__AssetCategoryName__c,
      FinServ__PrimaryOwner__c,
      FinServ__PrimaryOwner__r.Name
    FROM FinServ__FinancialHolding__c
    WHERE FinServ__FinancialAccount__c = '${safe}'
    ORDER BY FinServ__MarketValue__c DESC NULLS LAST
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<FinancialHoldingRecord>(soql);

    const data: FinancialHolding[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      financialAccountId: r.FinServ__FinancialAccount__c,
      financialAccountName: r.FinServ__FinancialAccount__r?.Name ?? null,
      symbol: r.FinServ__Symbol__c,
      shares: r.FinServ__Shares__c,
      price: r.FinServ__Price__c,
      purchasePrice: r.FinServ__PurchasePrice__c,
      marketValue: r.FinServ__MarketValue__c,
      gainLoss: r.FinServ__GainLoss__c,
      percentChange: r.FinServ__PercentChange__c,
      assetClass: r.FinServ__AssetClass__c,
      assetCategory: r.FinServ__AssetCategoryName__c ?? r.FinServ__AssetCategory__c,
      primaryOwnerName: r.FinServ__PrimaryOwner__r?.Name ?? null,
    }));

    const totalMarketValue = data.reduce((sum, h) => sum + (h.marketValue ?? 0), 0);
    const totalGainLoss = data.reduce((sum, h) => sum + (h.gainLoss ?? 0), 0);

    const header = [
      `Holdings for account: ${data[0]?.financialAccountName ?? input.financial_account_id}`,
      "─".repeat(40),
      `Total Market Value: ${formatCurrency(totalMarketValue)}  |  Total Gain/Loss: ${formatCurrency(totalGainLoss)}`,
      `${data.length} holding(s):`,
      "─".repeat(40),
    ].join("\n");

    const body = formatList(data, (h, i) => {
      const gainStr = h.gainLoss != null
        ? `${formatCurrency(h.gainLoss)} (${formatPercent(h.percentChange)})`
        : "N/A";
      return [
        `${i + 1}. ${h.name}${h.symbol ? ` [${h.symbol}]` : ""}`,
        `   Market Value: ${formatCurrency(h.marketValue)}  |  Gain/Loss: ${gainStr}`,
        `   Shares: ${h.shares ?? "N/A"}  |  Price: ${formatCurrency(h.price)}  |  Cost Basis: ${formatCurrency(h.purchasePrice)}`,
        `   Class: ${h.assetClass ?? "N/A"}  |  Category: ${h.assetCategory ?? "N/A"}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_get_financial_holdings failed: ${toMcpError(err)}`);
  }
}

// ── sf_get_assets_liabilities ─────────────────────────────────────────────

export const getAssetsLiabilitiesSchema = z.object({
  account_id: z
    .string()
    .min(1)
    .describe("Salesforce Account ID of the primary owner"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Records to return (1-50, default 20)"),
});

export type GetAssetsLiabilitiesInput = z.infer<typeof getAssetsLiabilitiesSchema>;

interface AssetLiabilityRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  FinServ__Amount__c: number | null;
  FinServ__AssetsAndLiabilitiesType__c: string | null;
  FinServ__Description__c: string | null;
  FinServ__Ownership__c: string | null;
  FinServ__PrimaryOwner__c: string | null;
  FinServ__PrimaryOwner__r: { Name: string } | null;
  FinServ__JointOwner__c: string | null;
  FinServ__FinancialAccount__c: string | null;
  RecordType: { Name: string } | null;
}

export interface AssetLiability {
  id: string;
  name: string;
  amount: number | null;
  type: string | null;
  description: string | null;
  ownership: string | null;
  primaryOwnerName: string | null;
  financialAccountId: string | null;
  recordTypeName: string | null;
}

export async function getAssetsLiabilities(
  input: GetAssetsLiabilitiesInput
): Promise<{ text: string; data: AssetLiability[] }> {
  const safe = input.account_id.replace(/'/g, "\\'");

  const soql = `
    SELECT Id, Name,
      FinServ__Amount__c,
      FinServ__AssetsAndLiabilitiesType__c,
      FinServ__Description__c,
      FinServ__Ownership__c,
      FinServ__PrimaryOwner__c,
      FinServ__PrimaryOwner__r.Name,
      FinServ__JointOwner__c,
      FinServ__FinancialAccount__c,
      RecordType.Name
    FROM FinServ__AssetsAndLiabilities__c
    WHERE FinServ__PrimaryOwner__c = '${safe}'
    ORDER BY FinServ__Amount__c DESC NULLS LAST
    LIMIT ${input.limit}
  `.trim();

  try {
    const records = await query<AssetLiabilityRecord>(soql);

    const data: AssetLiability[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      amount: r.FinServ__Amount__c,
      type: r.FinServ__AssetsAndLiabilitiesType__c,
      description: r.FinServ__Description__c,
      ownership: r.FinServ__Ownership__c,
      primaryOwnerName: r.FinServ__PrimaryOwner__r?.Name ?? null,
      financialAccountId: r.FinServ__FinancialAccount__c,
      recordTypeName: r.RecordType?.Name ?? null,
    }));

    const assets      = data.filter((r) => r.recordTypeName?.toLowerCase().includes("asset"));
    const liabilities = data.filter((r) => r.recordTypeName?.toLowerCase().includes("liabilit"));
    const other       = data.filter((r) => !assets.includes(r) && !liabilities.includes(r));

    const totalAssets      = assets.reduce((s, r) => s + (r.amount ?? 0), 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + (r.amount ?? 0), 0);

    const renderItem = (r: AssetLiability, i: number) =>
      [
        `${i + 1}. ${r.name}`,
        `   Amount: ${formatCurrency(r.amount)}  |  Type: ${r.type ?? "N/A"}`,
        ...(r.description ? [`   ${r.description.slice(0, 120)}`] : []),
      ].join("\n");

    const sections: string[] = [
      `Assets & Liabilities — ${data.length} record(s)\n${"─".repeat(40)}`,
    ];

    if (assets.length > 0) {
      sections.push(`ASSETS (total: ${formatCurrency(totalAssets)}):`);
      sections.push(formatList(assets, renderItem));
    }
    if (liabilities.length > 0) {
      sections.push(`\nLIABILITIES (total: ${formatCurrency(totalLiabilities)}):`);
      sections.push(formatList(liabilities, renderItem));
    }
    if (other.length > 0) {
      sections.push(`\nOTHER:`);
      sections.push(formatList(other, renderItem));
    }

    return { text: sections.join("\n"), data };
  } catch (err) {
    throw new Error(`sf_get_assets_liabilities failed: ${toMcpError(err)}`);
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

interface ClientSummaryAccountRecord extends SFQueryRecord {
  FinServ__FinancialAccountType__c: string | null;
  FinServ__Balance__c: number | null;
}

interface ClientSummaryALRecord extends SFQueryRecord {
  FinServ__Amount__c: number | null;
  RecordType: { Name: string } | null;
  FinServ__AssetsAndLiabilitiesType__c: string | null;
}

interface ClientAccountNameRecord extends SFQueryRecord {
  Name: string;
}

interface FinancialTypeSummary {
  type: string;
  count: number;
  totalBalance: number;
}

interface ALBreakdown {
  type: string;
  amount: number;
}

export interface ClientSummaryData {
  accountId: string;
  accountName: string | null;
  financialAccountsByType: FinancialTypeSummary[];
  totalFinancialBalance: number;
  assetBreakdown: ALBreakdown[];
  liabilityBreakdown: ALBreakdown[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export async function getClientSummary(
  input: GetClientSummaryInput
): Promise<{ text: string; data: ClientSummaryData }> {
  const safe = input.account_id.replace(/'/g, "\\'");

  try {
    const [nameRecords, finAccounts, assetsLiabs] = await Promise.all([
      query<ClientAccountNameRecord>(
        `SELECT Name FROM Account WHERE Id = '${safe}' LIMIT 1`
      ),
      query<ClientSummaryAccountRecord>(`
        SELECT FinServ__FinancialAccountType__c, FinServ__Balance__c
        FROM FinServ__FinancialAccount__c
        WHERE FinServ__PrimaryOwner__c = '${safe}'
        LIMIT 200
      `),
      query<ClientSummaryALRecord>(`
        SELECT FinServ__Amount__c, RecordType.Name, FinServ__AssetsAndLiabilitiesType__c
        FROM FinServ__AssetsAndLiabilities__c
        WHERE FinServ__PrimaryOwner__c = '${safe}'
        LIMIT 200
      `),
    ]);

    const accountName = nameRecords[0]?.Name ?? null;

    // Group financial accounts by type
    const byType = new Map<string, { count: number; total: number }>();
    for (const r of finAccounts) {
      const type = r.FinServ__FinancialAccountType__c ?? "Other";
      const entry = byType.get(type) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += r.FinServ__Balance__c ?? 0;
      byType.set(type, entry);
    }

    const financialAccountsByType: FinancialTypeSummary[] = [...byType.entries()]
      .map(([type, { count, total }]) => ({ type, count, totalBalance: total }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    const totalFinancialBalance = financialAccountsByType.reduce(
      (s, t) => s + t.totalBalance, 0
    );

    // Separate assets and liabilities
    const assetMap = new Map<string, number>();
    const liabMap  = new Map<string, number>();

    for (const r of assetsLiabs) {
      const rtName = r.RecordType?.Name?.toLowerCase() ?? "";
      const type   = r.FinServ__AssetsAndLiabilitiesType__c ?? "Other";
      const amount = r.FinServ__Amount__c ?? 0;

      if (rtName.includes("asset")) {
        assetMap.set(type, (assetMap.get(type) ?? 0) + amount);
      } else if (rtName.includes("liabilit")) {
        liabMap.set(type, (liabMap.get(type) ?? 0) + amount);
      } else {
        // Unknown record type — classify by sign
        if (amount >= 0) assetMap.set(type, (assetMap.get(type) ?? 0) + amount);
        else liabMap.set(type, (liabMap.get(type) ?? 0) + Math.abs(amount));
      }
    }

    const assetBreakdown: ALBreakdown[] = [...assetMap.entries()]
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount);

    const liabilityBreakdown: ALBreakdown[] = [...liabMap.entries()]
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount);

    const totalAssets      = assetBreakdown.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = liabilityBreakdown.reduce((s, r) => s + r.amount, 0);
    const netWorth         = totalAssets - totalLiabilities;

    const data: ClientSummaryData = {
      accountId: input.account_id,
      accountName,
      financialAccountsByType,
      totalFinancialBalance,
      assetBreakdown,
      liabilityBreakdown,
      totalAssets,
      totalLiabilities,
      netWorth,
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
        lines.push(`  ${t.type.padEnd(20)} ${t.count} account(s)  |  ${formatCurrency(t.totalBalance)}`);
      }
    }

    lines.push("", "ASSETS & LIABILITIES", divider);

    if (assetBreakdown.length > 0) {
      lines.push(`Assets (total: ${formatCurrency(totalAssets)}):`);
      for (const a of assetBreakdown) {
        lines.push(`  ${a.type.padEnd(24)} ${formatCurrency(a.amount)}`);
      }
    }

    if (liabilityBreakdown.length > 0) {
      lines.push(`\nLiabilities (total: ${formatCurrency(totalLiabilities)}):`);
      for (const l of liabilityBreakdown) {
        lines.push(`  ${l.type.padEnd(24)} ${formatCurrency(l.amount)}`);
      }
    }

    lines.push(
      "",
      divider,
      `NET WORTH:  ${formatCurrency(netWorth)}`
    );

    return { text: lines.join("\n"), data };
  } catch (err) {
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

interface FinancialAccountRoleRecord extends SFQueryRecord {
  Id: string;
  Name: string;
  FinServ__Role__c: string | null;
  FinServ__RelatedAccount__c: string | null;
  FinServ__RelatedAccount__r: { Name: string } | null;
  FinServ__RelatedContact__c: string | null;
  FinServ__RelatedContact__r: { Name: string } | null;
  FinServ__Active__c: boolean;
}

export interface FinancialAccountRole {
  id: string;
  name: string;
  role: string | null;
  relatedAccountId: string | null;
  relatedAccountName: string | null;
  relatedContactId: string | null;
  relatedContactName: string | null;
  active: boolean;
}

export async function getFinancialAccountRoles(
  input: GetFinancialAccountRolesInput
): Promise<{ text: string; data: FinancialAccountRole[] }> {
  const safe = input.financial_account_id.replace(/'/g, "\\'");

  const soql = `
    SELECT Id, Name,
      FinServ__Role__c,
      FinServ__RelatedAccount__c,
      FinServ__RelatedAccount__r.Name,
      FinServ__RelatedContact__c,
      FinServ__RelatedContact__r.Name,
      FinServ__Active__c
    FROM FinServ__FinancialAccountRole__c
    WHERE FinServ__FinancialAccount__c = '${safe}'
    AND FinServ__Active__c = true
  `.trim();

  try {
    const records = await query<FinancialAccountRoleRecord>(soql);

    const data: FinancialAccountRole[] = records.map((r) => ({
      id: r.Id,
      name: r.Name,
      role: r.FinServ__Role__c,
      relatedAccountId: r.FinServ__RelatedAccount__c,
      relatedAccountName: r.FinServ__RelatedAccount__r?.Name ?? null,
      relatedContactId: r.FinServ__RelatedContact__c,
      relatedContactName: r.FinServ__RelatedContact__r?.Name ?? null,
      active: r.FinServ__Active__c,
    }));

    const header = `Found ${data.length} active role(s) for financial account:\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      const person = r.relatedContactName ?? r.relatedAccountName ?? "Unknown";
      return [
        `${i + 1}. ${person}`,
        `   Role: ${r.role ?? "N/A"}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
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

interface AccountRelationshipRecord extends SFQueryRecord {
  Id: string;
  FinServ__Account__c: string;
  FinServ__Account__r: { Name: string } | null;
  FinServ__RelatedAccount__c: string;
  FinServ__RelatedAccount__r: { Name: string } | null;
  FinServ__AssociationType__c: string | null;
  FinServ__Role__r: { Name: string } | null;
  FinServ__Active__c: boolean;
}

export interface AccountRelationship {
  id: string;
  accountId: string;
  accountName: string | null;
  relatedAccountId: string;
  relatedAccountName: string | null;
  associationType: string | null;
  role: string | null;
  active: boolean;
}

export async function getAccountRelationships(
  input: GetAccountRelationshipsInput
): Promise<{ text: string; data: AccountRelationship[] }> {
  const safe = input.account_id.replace(/'/g, "\\'");

  const soql = `
    SELECT Id,
      FinServ__Account__c,
      FinServ__Account__r.Name,
      FinServ__RelatedAccount__c,
      FinServ__RelatedAccount__r.Name,
      FinServ__AssociationType__c,
      FinServ__Role__r.Name,
      FinServ__Active__c
    FROM FinServ__AccountAccountRelation__c
    WHERE (FinServ__Account__c = '${safe}'
      OR FinServ__RelatedAccount__c = '${safe}')
    AND FinServ__Active__c = true
  `.trim();

  try {
    const records = await query<AccountRelationshipRecord>(soql);

    const data: AccountRelationship[] = records.map((r) => ({
      id: r.Id,
      accountId: r.FinServ__Account__c,
      accountName: r.FinServ__Account__r?.Name ?? null,
      relatedAccountId: r.FinServ__RelatedAccount__c,
      relatedAccountName: r.FinServ__RelatedAccount__r?.Name ?? null,
      associationType: r.FinServ__AssociationType__c,
      role: r.FinServ__Role__r?.Name ?? null,
      active: r.FinServ__Active__c,
    }));

    const header = `Found ${data.length} active relationship(s):\n${"─".repeat(40)}`;
    const body = formatList(data, (r, i) => {
      const otherName = r.accountId === input.account_id
        ? (r.relatedAccountName ?? r.relatedAccountId)
        : (r.accountName ?? r.accountId);
      return [
        `${i + 1}. ${otherName}`,
        `   Role: ${r.role ?? "N/A"}  |  Type: ${r.associationType ?? "N/A"}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data };
  } catch (err) {
    throw new Error(`sf_get_account_relationships failed: ${toMcpError(err)}`);
  }
}
