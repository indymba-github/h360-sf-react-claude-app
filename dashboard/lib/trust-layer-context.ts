/**
 * Trust Layer mode doesn't have tool access, so we prefetch relevant Salesforce
 * data and inject it into the system prompt as structured text. This gives the
 * model context to answer account-specific questions without needing to call tools.
 *
 * Used only in Trust Layer mode. The standard Anthropic path lets the model call
 * tools dynamically.
 */

import {
  getAccount,
  getAccountOpportunities,
  getFinancialAccountsForAccount,
  getAccountContacts,
  getNewsAlerts,
  getAccountCases,
  type SFAccount,
  type SFOpportunity,
  type SFContact,
  type SFCase,
  type SFTask,
} from "./salesforce";
import type { FinancialAccountWithRole } from "./financial-accounts";

export type PrefetchedAccountContext = {
  accountSummary: string;
  opportunitiesSummary: string;
  financialAccountsSummary: string;
  contactsSummary: string;
  newsAlertsSummary: string;
  casesSummary: string;
};

type SFAccountWithOwner = SFAccount & {
  Owner?: { Name?: string | null } | null;
};

export async function prefetchAccountContext(
  accountId: string,
  accessToken: string,
  instanceUrl: string,
): Promise<PrefetchedAccountContext> {
  const [account, opportunities, financialAccounts, contacts, newsAlerts, cases] =
    await Promise.all([
      getAccount(instanceUrl, accessToken, accountId).catch(() => null),
      getAccountOpportunities(instanceUrl, accessToken, accountId).catch(() => []),
      getFinancialAccountsForAccount(instanceUrl, accessToken, accountId).catch(() => []),
      getAccountContacts(instanceUrl, accessToken, accountId).catch(() => []),
      getNewsAlerts(instanceUrl, accessToken, accountId).catch(() => []),
      getAccountCases(instanceUrl, accessToken, accountId).catch(() => []),
    ]);

  return {
    accountSummary: formatAccountSummary(account),
    opportunitiesSummary: formatOpportunitiesSummary(opportunities),
    financialAccountsSummary: formatFinancialAccountsSummary(financialAccounts),
    contactsSummary: formatContactsSummary(contacts),
    newsAlertsSummary: formatNewsAlertsSummary(newsAlerts),
    casesSummary: formatCasesSummary(cases),
  };
}

function formatAccountSummary(account: SFAccount | null): string {
  if (!account) return "";
  const lines: string[] = ["ACCOUNT DETAILS"];
  lines.push(`Name: ${account.Name}`);
  if (account.Industry) lines.push(`Industry: ${account.Industry}`);
  if (account.AnnualRevenue != null) lines.push(`Annual Revenue: ${formatCurrency(account.AnnualRevenue)}`);
  if (account.NumberOfEmployees) lines.push(`Employees: ${account.NumberOfEmployees.toLocaleString()}`);
  if (account.Phone) lines.push(`Phone: ${account.Phone}`);
  if (account.Website) lines.push(`Website: ${account.Website}`);
  const location = [account.BillingCity, account.BillingState].filter(Boolean).join(", ");
  if (location) lines.push(`Location: ${location}`);
  const ownerName = (account as SFAccountWithOwner).Owner?.Name;
  if (ownerName) lines.push(`Relationship Manager: ${ownerName}`);
  if (account.Description) lines.push(`Description: ${truncate(account.Description, 300)}`);
  return lines.join("\n");
}

function formatOpportunitiesSummary(opps: SFOpportunity[]): string {
  if (opps.length === 0) return "OPPORTUNITIES\nNo opportunities found for this account.";

  const open = opps.filter((o) => !isClosed(o.StageName));
  const won = opps.filter((o) => o.StageName === "Closed Won");
  const lost = opps.filter((o) => o.StageName === "Closed Lost");
  const lines: string[] = ["OPPORTUNITIES"];

  if (open.length > 0) {
    lines.push(`Open (${open.length}):`);
    open.slice(0, 10).forEach((o) => {
      lines.push(
        `  • ${o.Name} | ${o.StageName} | ${formatCurrency(o.Amount)} | Close: ${formatDate(o.CloseDate)}`,
      );
    });
    if (open.length > 10) lines.push(`  ... and ${open.length - 10} more`);
  }

  if (won.length > 0) {
    const totalWon = won.reduce((sum, o) => sum + (o.Amount ?? 0), 0);
    lines.push(`\nClosed Won (${won.length}): Total ${formatCurrency(totalWon)}`);
    won.slice(0, 5).forEach((o) => {
      lines.push(`  • ${o.Name} | ${formatCurrency(o.Amount)} | ${formatDate(o.CloseDate)}`);
    });
  }

  if (lost.length > 0) {
    const totalLost = lost.reduce((sum, o) => sum + (o.Amount ?? 0), 0);
    lines.push(`\nClosed Lost (${lost.length}): Total ${formatCurrency(totalLost)}`);
  }

  return lines.join("\n");
}

function formatFinancialAccountsSummary(accounts: FinancialAccountWithRole[]): string {
  if (accounts.length === 0) return "FINANCIAL ACCOUNTS\nNo financial accounts found.";
  const lines: string[] = ["FINANCIAL ACCOUNTS"];
  accounts.slice(0, 15).forEach((fa) => {
    const balance = fa.CurrentBalance != null ? formatCurrency(fa.CurrentBalance) : "(no balance)";
    const name = fa.Name || "(unnamed)";
    const type = fa.Type || "Account";
    const role = fa.Role ? ` [${fa.Role}]` : "";
    lines.push(`  • ${name} | ${type}${role} | ${balance}`);
  });
  if (accounts.length > 15) lines.push(`  ... and ${accounts.length - 15} more`);
  return lines.join("\n");
}

function formatContactsSummary(contacts: SFContact[]): string {
  if (contacts.length === 0) return "CONTACTS\nNo contacts found.";
  const lines: string[] = ["CONTACTS"];
  contacts.slice(0, 10).forEach((c) => {
    const parts: string[] = [c.Name];
    if (c.Title) parts.push(c.Title);
    if (c.Email) parts.push(c.Email);
    lines.push(`  • ${parts.join(" | ")}`);
  });
  if (contacts.length > 10) lines.push(`  ... and ${contacts.length - 10} more`);
  return lines.join("\n");
}

function formatNewsAlertsSummary(alerts: SFTask[]): string {
  if (alerts.length === 0) return "";
  const lines: string[] = ["RECENT NEWS ALERTS"];
  alerts.slice(0, 5).forEach((a) => {
    const subject = (a.Subject ?? "").replace(/^News Alert:\s*/i, "");
    lines.push(`  • ${subject} (${formatDate(a.CreatedDate)})`);
    if (a.Description) {
      const summary = a.Description.replace(/[#*_`]/g, "").replace(/\n+/g, " ").trim();
      lines.push(`    ${truncate(summary, 200)}`);
    }
  });
  return lines.join("\n");
}

function formatCasesSummary(cases: SFCase[]): string {
  if (cases.length === 0) return "";
  const lines: string[] = ["CASES"];
  cases.slice(0, 10).forEach((c) => {
    lines.push(`  • ${c.CaseNumber}: ${c.Subject ?? "(no subject)"} | ${c.Status} | ${c.Priority ?? "—"}`);
  });
  return lines.join("\n");
}

export function formatPrefetchedContext(ctx: PrefetchedAccountContext): string {
  return [
    ctx.accountSummary,
    ctx.opportunitiesSummary,
    ctx.financialAccountsSummary,
    ctx.contactsSummary,
    ctx.newsAlertsSummary,
    ctx.casesSummary,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join("\n\n");
}

function isClosed(stageName: string): boolean {
  return stageName === "Closed Won" || stageName === "Closed Lost";
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "(unknown)";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "(no date)";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str;
  return str.substring(0, max - 3) + "...";
}
