import { formatCount, formatCurrency, formatDate } from "./format";
import type { SFAccount } from "./salesforce";

export type AccountsQuickFilter = "all" | "starred" | "recent" | "needs-attention";

export type AccountActivityTone = "recent" | "current" | "stale" | "unknown";

export type AccountDirectoryCard = {
  id: string;
  name: string;
  industryLabel: string;
  marketLabel: string;
  revenueLabel: string;
  employeesLabel: string;
  lastActivityLabel: string;
  activityTone: AccountActivityTone;
  statusLine: string;
  dataGaps: string[];
  needsAttention: boolean;
  isRecentlyTouched: boolean;
  isStarred: boolean;
  account: SFAccount;
};

export type AccountsDirectorySummary = {
  totalCount: number;
  visibleCount: number;
  recentlyTouchedCount: number;
  staleCount: number;
  dataGapCount: number;
  needsAttentionCount: number;
};

export type AccountsDirectory = {
  summary: AccountsDirectorySummary;
  cards: AccountDirectoryCard[];
};

export type AccountsDirectoryInput = {
  accounts: SFAccount[];
  totalCount: number;
  starredIds?: string[];
  now?: Date;
};

const RECENT_DAYS = 30;
const STALE_DAYS = 90;

function parseSalesforceDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value: string | null | undefined, now: Date): number | null {
  const date = parseSalesforceDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function formatMarket(account: SFAccount): string {
  const parts = [account.BillingCity, account.BillingState].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Market unavailable";
}

function getDataGaps(account: SFAccount): string[] {
  const gaps: string[] = [];
  if (account.AnnualRevenue == null) gaps.push("Revenue");
  if (account.NumberOfEmployees == null) gaps.push("Employees");
  if (!account.BillingCity && !account.BillingState) gaps.push("Market");
  return gaps;
}

function getActivityTone(activityDays: number | null): AccountActivityTone {
  if (activityDays == null) return "unknown";
  if (activityDays <= RECENT_DAYS) return "recent";
  if (activityDays > STALE_DAYS) return "stale";
  return "current";
}

function buildStatusLine({
  activityTone,
  lastActivityLabel,
  dataGaps,
}: {
  activityTone: AccountActivityTone;
  lastActivityLabel: string;
  dataGaps: string[];
}): string {
  if (activityTone === "unknown") return "No activity on file.";
  if (activityTone === "stale") return `Stale relationship; last touch ${lastActivityLabel}.`;
  if (dataGaps.length >= 2) return `Missing ${dataGaps.join(", ").toLowerCase()} data.`;
  if (activityTone === "recent") return `Recently touched ${lastActivityLabel}.`;
  return `Last touch ${lastActivityLabel}.`;
}

function buildCard(account: SFAccount, starredIds: Set<string>, now: Date): AccountDirectoryCard {
  const activityDays = daysSince(account.LastActivityDate, now);
  const activityTone = getActivityTone(activityDays);
  const dataGaps = getDataGaps(account);
  const needsAttention = activityTone === "unknown" || activityTone === "stale" || dataGaps.length >= 2;
  const lastActivityLabel = account.LastActivityDate ? formatDate(account.LastActivityDate) : "No activity";

  return {
    id: account.Id,
    name: account.Name,
    industryLabel: account.Industry ?? account.Type ?? "Account",
    marketLabel: formatMarket(account),
    revenueLabel: formatCurrency(account.AnnualRevenue),
    employeesLabel: formatCount(account.NumberOfEmployees),
    lastActivityLabel,
    activityTone,
    statusLine: buildStatusLine({ activityTone, lastActivityLabel, dataGaps }),
    dataGaps,
    needsAttention,
    isRecentlyTouched: activityTone === "recent",
    isStarred: starredIds.has(account.Id),
    account,
  };
}

export function buildAccountsDirectory({
  accounts,
  totalCount,
  starredIds = [],
  now = new Date(),
}: AccountsDirectoryInput): AccountsDirectory {
  const starred = new Set(starredIds);
  const cards = accounts.map((account) => buildCard(account, starred, now));

  return {
    summary: {
      totalCount,
      visibleCount: cards.length,
      recentlyTouchedCount: cards.filter((card) => card.isRecentlyTouched).length,
      staleCount: cards.filter((card) => card.activityTone === "stale" || card.activityTone === "unknown").length,
      dataGapCount: cards.filter((card) => card.dataGaps.length > 0).length,
      needsAttentionCount: cards.filter((card) => card.needsAttention).length,
    },
    cards,
  };
}

export function filterAccountsDirectoryCards(
  cards: AccountDirectoryCard[],
  filter: AccountsQuickFilter,
): AccountDirectoryCard[] {
  if (filter === "starred") return cards.filter((card) => card.isStarred);
  if (filter === "recent") return cards.filter((card) => card.isRecentlyTouched);
  if (filter === "needs-attention") return cards.filter((card) => card.needsAttention);
  return cards;
}
