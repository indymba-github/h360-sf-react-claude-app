import { formatCount, formatCurrency, formatDate } from "./format";
import type { AccountSortBy, SFAccount } from "./salesforce";

export type AccountsQuickFilter = "all" | "starred" | "recent" | "needs-attention";

const ACCOUNTS_QUICK_FILTERS: AccountsQuickFilter[] = ["all", "starred", "recent", "needs-attention"];
const ACCOUNT_SORT_OPTIONS: AccountSortBy[] = ["name-asc", "revenue-desc", "last-activity-desc"];

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
  attentionReasons: string[];
  relationshipAction: string;
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

export type AccountsDirectoryQueryState = {
  filter: AccountsQuickFilter;
  sortBy: AccountSortBy;
  search: string;
  industry: string;
};

const RECENT_DAYS = 30;
const STALE_DAYS = 90;

export function normalizeAccountsQuickFilter(value: string | string[] | null | undefined): AccountsQuickFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ACCOUNTS_QUICK_FILTERS.includes(candidate as AccountsQuickFilter)
    ? candidate as AccountsQuickFilter
    : "all";
}

function firstParam(value: string | string[] | null | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeAccountSort(value: string | string[] | null | undefined): AccountSortBy {
  const candidate = firstParam(value);
  return ACCOUNT_SORT_OPTIONS.includes(candidate as AccountSortBy)
    ? candidate as AccountSortBy
    : "name-asc";
}

export function normalizeAccountsDirectoryQuery(searchParams: {
  filter?: string | string[];
  sortBy?: string | string[];
  search?: string | string[];
  industry?: string | string[];
} = {}): AccountsDirectoryQueryState {
  const search = firstParam(searchParams.search).trim();
  const industry = firstParam(searchParams.industry).trim();

  return {
    filter: normalizeAccountsQuickFilter(searchParams.filter),
    sortBy: normalizeAccountSort(searchParams.sortBy),
    search,
    industry: industry.length > 0 ? industry : "all",
  };
}

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

function buildAttentionReasons(activityTone: AccountActivityTone, dataGaps: string[]): string[] {
  const reasons: string[] = [];
  if (activityTone === "unknown") reasons.push("No activity");
  if (activityTone === "stale") reasons.push("Stale activity");
  for (const gap of dataGaps) reasons.push(`Missing ${gap.toLowerCase()}`);
  return reasons;
}

function buildRelationshipAction(activityTone: AccountActivityTone, dataGaps: string[]): string {
  const hasActivityRisk = activityTone === "unknown" || activityTone === "stale";
  if (hasActivityRisk && dataGaps.length > 0) return "Schedule outreach and fill key account gaps.";
  if (hasActivityRisk) return "Schedule the next relationship touch.";
  if (dataGaps.length > 0) return "Fill account context before the next conversation.";
  if (activityTone === "recent") return "Review recent movement and decide the next step.";
  return "Keep relationship context current.";
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
    attentionReasons: buildAttentionReasons(activityTone, dataGaps),
    relationshipAction: buildRelationshipAction(activityTone, dataGaps),
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
