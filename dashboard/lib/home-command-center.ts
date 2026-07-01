import { formatCount, formatCurrency } from "./format";

export type HomeFocusTone = "critical" | "watch" | "prep" | "momentum" | "neutral";

export type HomeFocusItem = {
  id: "service" | "pipeline" | "agenda" | "movement" | "quiet";
  label: string;
  value: string;
  title: string;
  detail: string;
  tone: HomeFocusTone;
  href?: string;
};

export type HomeHealthMetric = {
  id: "pipeline" | "stalled" | "service" | "coverage";
  label: string;
  value: string;
  detail: string;
  tone: HomeFocusTone;
};

export type HomeDashboardTakeaway = {
  id: "stage" | "forecast" | "aging";
  label: string;
  value: string;
  detail: string;
};

export type HomeCaseSignal = {
  id: string;
  subject: string | null;
  accountId: string | null;
  accountName: string | null;
  status: string;
  createdDate: string;
};

export type HomeRecentAccountSignal = {
  id: string;
  name: string;
  industry: string | null;
  lastModifiedDate: string;
};

export type HomeAgendaSignal = {
  id: string;
  type: "event" | "task";
  subject: string;
  relatedName: string | null;
  relatedId: string | null;
};

export type HomeAgingOpportunitySignal = {
  id: string;
  accountId: string | null;
  name: string;
  stageName: string;
  amount: number | null;
  daysStalled: number;
};

export type HomeForecastBucket = {
  label: string;
  range: string;
  amount: number;
  count: number;
};

export type HomePipelineStage = {
  StageName: string;
  cnt: number;
  totalAmt: number | null;
};

export type HomeCommandCenterInput = {
  accountCount: number;
  openPipelineAmount: number | null;
  openPipelineCount: number | null;
  winRate: number | null;
  modifiedThisWeek: number;
  highPriorityCases: HomeCaseSignal[];
  recentAccounts: HomeRecentAccountSignal[];
  agendaItems: HomeAgendaSignal[];
  agingOpportunities: HomeAgingOpportunitySignal[];
  forecastBuckets: HomeForecastBucket[];
  pipelineStages: HomePipelineStage[];
};

export type HomeCommandCenter = {
  focusItems: HomeFocusItem[];
  healthMetrics: HomeHealthMetric[];
  takeaways: HomeDashboardTakeaway[];
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralLabel}`;
}

function compactSubject(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function sortAgingOpportunities(opportunities: HomeAgingOpportunitySignal[]): HomeAgingOpportunitySignal[] {
  return [...opportunities].sort((a, b) => {
    if (b.daysStalled !== a.daysStalled) return b.daysStalled - a.daysStalled;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}

function buildFocusItems(input: HomeCommandCenterInput): HomeFocusItem[] {
  const items: HomeFocusItem[] = [];
  const topCase = input.highPriorityCases[0];
  const stalledOpps = sortAgingOpportunities(input.agingOpportunities.filter((opp) => opp.daysStalled >= 30));
  const topStalled = stalledOpps[0];
  const topAgenda = input.agendaItems[0];
  const topRecent = input.recentAccounts[0];

  if (topCase) {
    const caseCount = input.highPriorityCases.length;
    const accountName = topCase.accountName ?? "an account";
    items.push({
      id: "service",
      label: "Service escalation",
      value: formatCount(caseCount),
      title: compactSubject(topCase.subject, "High-priority case"),
      detail: `${accountName} has ${plural(caseCount, "high-priority case")} open.`,
      tone: "critical",
      ...(topCase.accountId ? { href: `/accounts/${topCase.accountId}` } : {}),
    });
  }

  if (topStalled) {
    items.push({
      id: "pipeline",
      label: "Stalled pipeline",
      value: formatCurrency(topStalled.amount),
      title: topStalled.name,
      detail: `${topStalled.stageName} has been idle ${topStalled.daysStalled} days.`,
      tone: "watch",
      ...(topStalled.accountId ? { href: `/accounts/${topStalled.accountId}` } : {}),
    });
  }

  if (topAgenda) {
    const related = topAgenda.relatedName ? ` with ${topAgenda.relatedName}` : "";
    items.push({
      id: "agenda",
      label: topAgenda.type === "event" ? "Meeting prep" : "Task prep",
      value: formatCount(input.agendaItems.length),
      title: topAgenda.subject,
      detail: `${plural(input.agendaItems.length, "agenda item")} scheduled today${related}.`,
      tone: "prep",
      ...(topAgenda.relatedId ? { href: `/accounts/${topAgenda.relatedId}` } : {}),
    });
  }

  if (topRecent && input.modifiedThisWeek > 0) {
    items.push({
      id: "movement",
      label: "Account movement",
      value: formatCount(input.modifiedThisWeek),
      title: topRecent.name,
      detail: `${plural(input.modifiedThisWeek, "account")} touched this week. Latest update: ${topRecent.industry ?? "Account"}.`,
      tone: "momentum",
      href: `/accounts/${topRecent.id}`,
    });
  }

  if (items.length === 0) {
    return [{
      id: "quiet",
      label: "Book status",
      value: "Clear",
      title: "No urgent items in the current view",
      detail: "No urgent service, pipeline, agenda, or account movement signals from the current Home data.",
      tone: "neutral",
    }];
  }

  return items.slice(0, 4);
}

function buildHealthMetrics(input: HomeCommandCenterInput): HomeHealthMetric[] {
  const stalledOpps = input.agingOpportunities.filter((opp) => opp.daysStalled >= 30);
  const stalledAmount = stalledOpps.reduce((sum, opp) => sum + (opp.amount ?? 0), 0);

  return [
    {
      id: "pipeline",
      label: "Open pipeline",
      value: formatCurrency(input.openPipelineAmount),
      detail: `${plural(input.openPipelineCount ?? 0, "open opportunity", "open opportunities")}${input.winRate != null ? `; ${input.winRate}% win rate` : ""}.`,
      tone: "momentum",
    },
    {
      id: "stalled",
      label: "Stalled pipeline",
      value: formatCurrency(stalledAmount),
      detail: stalledOpps.length > 0
        ? `${plural(stalledOpps.length, "opportunity", "opportunities")} stalled 30+ days.`
        : "No opportunities stalled 30+ days.",
      tone: stalledOpps.length > 0 ? "watch" : "neutral",
    },
    {
      id: "service",
      label: "Service load",
      value: formatCount(input.highPriorityCases.length),
      detail: input.highPriorityCases.length > 0
        ? `${plural(input.highPriorityCases.length, "high-priority case")} needs attention.`
        : "No high-priority cases in the current queue.",
      tone: input.highPriorityCases.length > 0 ? "critical" : "neutral",
    },
    {
      id: "coverage",
      label: "Recent coverage",
      value: formatCount(input.modifiedThisWeek),
      detail: `${plural(input.modifiedThisWeek, "account")} touched this week across ${plural(input.accountCount, "owned account")}.`,
      tone: input.modifiedThisWeek > 0 ? "prep" : "neutral",
    },
  ];
}

function buildTakeaways(input: HomeCommandCenterInput): HomeDashboardTakeaway[] {
  const topStage = [...input.pipelineStages]
    .sort((a, b) => (b.totalAmt ?? 0) - (a.totalAmt ?? 0) || b.cnt - a.cnt)[0];
  const topForecast = [...input.forecastBuckets]
    .sort((a, b) => b.amount - a.amount || b.count - a.count)[0];
  const topAging = sortAgingOpportunities(input.agingOpportunities)[0];

  return [
    {
      id: "stage",
      label: "Pipeline concentration",
      value: topStage ? formatCurrency(topStage.totalAmt) : "—",
      detail: topStage
        ? `${topStage.StageName} holds ${formatCurrency(topStage.totalAmt)} across ${plural(topStage.cnt, "opportunity", "opportunities")}.`
        : "No open pipeline stage data is available.",
    },
    {
      id: "forecast",
      label: "Forecast pressure",
      value: topForecast ? formatCurrency(topForecast.amount) : "—",
      detail: topForecast
        ? `${topForecast.label} carries ${formatCurrency(topForecast.amount)} across ${plural(topForecast.count, "opportunity", "opportunities")}.`
        : "No forecast buckets have open opportunity value.",
    },
    {
      id: "aging",
      label: "Aging signal",
      value: topAging ? `${topAging.daysStalled}d` : "Clear",
      detail: topAging
        ? `${topAging.name} is stalled ${topAging.daysStalled} days in ${topAging.stageName}.`
        : "No stalled pipeline in the current view.",
    },
  ];
}

export function buildHomeCommandCenter(input: HomeCommandCenterInput): HomeCommandCenter {
  return {
    focusItems: buildFocusItems(input),
    healthMetrics: buildHealthMetrics(input),
    takeaways: buildTakeaways(input),
  };
}
