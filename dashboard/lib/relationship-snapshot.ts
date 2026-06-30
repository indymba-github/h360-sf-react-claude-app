import type { FinancialAccountCategory, FinancialAccountWithRole } from "./financial-accounts";
import { categorizeFinancialAccount } from "./financial-accounts";
import { formatDate } from "./format";
import type { SFAccount, SFCase, SFContact, SFOpportunity } from "./salesforce";

export type SnapshotSeverity = "good" | "watch" | "risk" | "empty";

export type SnapshotMetric = {
  label: string;
  value: string;
};

export type SnapshotSignal = {
  id: "relationship" | "growth" | "service" | "coverage";
  label: string;
  value: string;
  detail: string;
  severity: SnapshotSeverity;
  metrics: SnapshotMetric[];
};

export type SnapshotPrompt = {
  label: string;
  question: string;
};

export type RelationshipSnapshot = {
  accountId: string;
  accountName: string;
  signals: SnapshotSignal[];
  relationship: SnapshotSignal;
  growth: SnapshotSignal;
  service: SnapshotSignal;
  coverage: SnapshotSignal;
  prompts: SnapshotPrompt[];
};

export type RelationshipSnapshotInput = {
  account: SFAccount;
  opportunities: SFOpportunity[];
  contacts: SFContact[];
  cases: SFCase[];
  financialAccounts: FinancialAccountWithRole[];
};

function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function buildRelationshipSignal(financialAccounts: FinancialAccountWithRole[]): SnapshotSignal {
  if (financialAccounts.length === 0) {
    return {
      id: "relationship",
      label: "Relationship",
      value: "No accounts",
      detail: "No financial accounts are linked to this Salesforce account yet.",
      severity: "empty",
      metrics: [
        { label: "Financial accounts", value: "0" },
        { label: "Product mix", value: "0" },
        { label: "Known assets", value: "Unavailable" },
      ],
    };
  }

  const categories = new Set<FinancialAccountCategory>();
  let knownAssets = 0;
  let debtExposure = 0;
  let creditExposure = 0;
  let hasKnownAssets = false;
  let hasDebtExposure = false;
  let hasCreditExposure = false;

  for (const account of financialAccounts) {
    const category = categorizeFinancialAccount(account.Type);
    categories.add(category);

    if (category === "Deposit" || category === "Investment" || category === "Other") {
      if (account.CurrentBalance != null) {
        knownAssets += account.CurrentBalance;
        hasKnownAssets = true;
      }
    }

    if (category === "Lending") {
      const exposure = account.TotalOutstandingAmount ?? account.PrincipalAmount ?? account.CurrentBalance;
      if (exposure != null) {
        debtExposure += exposure;
        hasDebtExposure = true;
      }
    }

    if (category === "Credit") {
      const outstanding = account.TotalOutstandingAmount ?? account.CurrentBalance;
      if (outstanding != null) {
        debtExposure += outstanding;
        hasDebtExposure = true;
      }

      if (account.CreditLimit != null) {
        creditExposure += account.CreditLimit;
        hasCreditExposure = true;
      }
    }
  }

  const assetLabel = hasKnownAssets ? `${formatCurrencyShort(knownAssets)} assets` : "Unavailable";
  const valueLabel = hasKnownAssets ? assetLabel : `${plural(financialAccounts.length, "account")}`;
  const detailParts = [`${plural(financialAccounts.length, "account")} across ${plural(categories.size, "product area")}`];
  if (hasDebtExposure) detailParts.push(`${formatCurrencyShort(debtExposure)} debt exposure`);
  if (hasCreditExposure) detailParts.push(`${formatCurrencyShort(creditExposure)} credit exposure`);
  if (!hasKnownAssets && !hasDebtExposure && !hasCreditExposure) detailParts.push("Balance data unavailable");

  const metrics: SnapshotMetric[] = [
    { label: "Financial accounts", value: String(financialAccounts.length) },
    { label: "Product mix", value: String(categories.size) },
    { label: "Known assets", value: assetLabel },
  ];
  if (hasDebtExposure) metrics.push({ label: "Debt exposure", value: formatCurrencyShort(debtExposure) });
  if (hasCreditExposure) metrics.push({ label: "Credit exposure", value: formatCurrencyShort(creditExposure) });

  return {
    id: "relationship",
    label: "Relationship",
    value: valueLabel,
    detail: `${detailParts.join(". ")}.`,
    severity: hasKnownAssets || hasDebtExposure || hasCreditExposure || categories.size > 1 ? "good" : "watch",
    metrics,
  };
}

function buildGrowthSignal(opportunities: SFOpportunity[]): SnapshotSignal {
  const openOpps = opportunities.filter((opp) => !opp.StageName.toLowerCase().startsWith("closed"));

  if (openOpps.length === 0) {
    return {
      id: "growth",
      label: "Growth",
      value: "No open pipeline",
      detail: "No open opportunities are currently linked to this account.",
      severity: "empty",
      metrics: [
        { label: "Open opps", value: "0" },
        { label: "Pipeline", value: "$0" },
        { label: "Next close", value: "None" },
      ],
    };
  }

  const openTotal = openOpps.reduce((sum, opp) => sum + (opp.Amount ?? 0), 0);
  const nextClose = [...openOpps].sort((a, b) => a.CloseDate.localeCompare(b.CloseDate))[0];
  const highestProbability = [...openOpps].sort((a, b) => (b.Probability ?? 0) - (a.Probability ?? 0))[0];
  const valueLabel = formatCurrencyShort(openTotal);
  const detailParts = [`${plural(openOpps.length, "open opportunity", "open opportunities")}`];

  if (nextClose?.CloseDate) detailParts.push(`Next close ${formatDate(nextClose.CloseDate)}`);
  if (highestProbability?.Probability != null) {
    detailParts.push(`${highestProbability.Name} at ${highestProbability.Probability}%`);
  }

  return {
    id: "growth",
    label: "Growth",
    value: valueLabel,
    detail: `${detailParts.join(". ")}.`,
    severity: openTotal > 0 ? "good" : "watch",
    metrics: [
      { label: "Open opps", value: String(openOpps.length) },
      { label: "Pipeline", value: valueLabel },
      { label: "Next close", value: nextClose?.CloseDate ? formatDate(nextClose.CloseDate) : "None" },
    ],
  };
}

function buildServiceSignal(cases: SFCase[]): SnapshotSignal {
  const openCases = cases.filter((item) => item.Status !== "Closed");
  const highPriorityOpenCases = openCases.filter((item) => item.Priority === "High");

  if (openCases.length === 0) {
    return {
      id: "service",
      label: "Service",
      value: "No open cases",
      detail: "No open service cases are currently linked to this account.",
      severity: "good",
      metrics: [
        { label: "Open cases", value: "0" },
        { label: "High priority", value: "0" },
        { label: "Recent case", value: "None" },
      ],
    };
  }

  const recentCase = [...openCases].sort((a, b) => b.CreatedDate.localeCompare(a.CreatedDate))[0];

  return {
    id: "service",
    label: "Service",
    value: `${openCases.length} open`,
    detail: `${plural(highPriorityOpenCases.length, "high priority case")} open. Most recent case ${formatDate(recentCase.CreatedDate)}.`,
    severity: highPriorityOpenCases.length > 0 ? "risk" : "watch",
    metrics: [
      { label: "Open cases", value: String(openCases.length) },
      { label: "High priority", value: String(highPriorityOpenCases.length) },
      { label: "Recent case", value: formatDate(recentCase.CreatedDate) },
    ],
  };
}

function buildCoverageSignal(contacts: SFContact[]): SnapshotSignal {
  if (contacts.length === 0) {
    return {
      id: "coverage",
      label: "Coverage",
      value: "No contacts",
      detail: "No contacts are linked to this account yet.",
      severity: "empty",
      metrics: [
        { label: "Contacts", value: "0" },
        { label: "Email coverage", value: "0%" },
        { label: "Phone coverage", value: "0%" },
      ],
    };
  }

  const emailCount = contacts.filter((contact) => !!contact.Email).length;
  const phoneCount = contacts.filter((contact) => !!contact.Phone).length;
  const emailCoverage = Math.round((emailCount / contacts.length) * 100);
  const phoneCoverage = Math.round((phoneCount / contacts.length) * 100);

  return {
    id: "coverage",
    label: "Coverage",
    value: plural(contacts.length, "contact"),
    detail: `${emailCoverage}% email coverage. ${phoneCoverage}% phone coverage.`,
    severity: emailCoverage < 50 || phoneCoverage < 50 ? "watch" : "good",
    metrics: [
      { label: "Contacts", value: String(contacts.length) },
      { label: "Email coverage", value: `${emailCoverage}%` },
      { label: "Phone coverage", value: `${phoneCoverage}%` },
    ],
  };
}

export function buildRelationshipSnapshot(input: RelationshipSnapshotInput): RelationshipSnapshot {
  const relationship = buildRelationshipSignal(input.financialAccounts);
  const growth = buildGrowthSignal(input.opportunities);
  const service = buildServiceSignal(input.cases);
  const coverage = buildCoverageSignal(input.contacts);

  return {
    accountId: input.account.Id,
    accountName: input.account.Name,
    signals: [relationship, growth, service, coverage],
    relationship,
    growth,
    service,
    coverage,
    prompts: [
      {
        label: "Explain relationship",
        question: `Explain the relationship with ${input.account.Name}. Focus on financial products, growth, service, and relationship coverage.`,
      },
      {
        label: "Find growth",
        question: `Where is the growth opportunity for ${input.account.Name}?`,
      },
      {
        label: "Check service risk",
        question: `What service risks should I watch for ${input.account.Name}?`,
      },
      {
        label: "Prep next meeting",
        question: `What should I do before the next meeting with ${input.account.Name}?`,
      },
    ],
  };
}
