"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { SFAccount, AccountSortBy } from "@/lib/salesforce";
import {
  buildAccountsDirectory,
  filterAccountsDirectoryCards,
  type AccountActivityTone,
  type AccountDirectoryCard,
  type AccountsQuickFilter,
} from "@/lib/accounts-directory";
import SalesforceLink from "@/components/SalesforceLink";

interface Props {
  instanceUrl?: string;
  initialAccounts: SFAccount[];
  initialHasMore: boolean;
  initialTotalCount: number;
  industries: string[];
}

function getStarred(): string[] {
  try {
    const raw = localStorage.getItem("accounts.starred");
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function StarButton({ accountId, starred, onToggle }: { accountId: string; starred: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(accountId); }}
      className="shrink-0 transition-opacity"
      style={{ color: starred ? "var(--color-accent)" : "var(--color-border)", opacity: starred ? 1 : 0 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      onMouseLeave={(e) => { if (!starred) (e.currentTarget as HTMLElement).style.opacity = "0"; }}
      title={starred ? "Unstar" : "Star account"}
    >
      <svg className="w-3.5 h-3.5" fill={starred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    </button>
  );
}

const SORT_LABELS: Record<AccountSortBy, string> = {
  "name-asc": "Name (A–Z)",
  "revenue-desc": "Revenue (high to low)",
  "last-activity-desc": "Last activity (recent first)",
};

const QUICK_FILTERS: Array<{ id: AccountsQuickFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "starred", label: "Starred" },
  { id: "recent", label: "Recently touched" },
  { id: "needs-attention", label: "Needs attention" },
];

function activityColor(tone: AccountActivityTone): string {
  if (tone === "recent") return "var(--color-success)";
  if (tone === "stale" || tone === "unknown") return "var(--color-danger)";
  return "var(--color-ink-soft)";
}

function SummaryMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "good" | "watch" }) {
  const color = tone === "good"
    ? "var(--color-success)"
    : tone === "watch"
      ? "var(--color-danger)"
      : "var(--color-ink)";

  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", padding: "11px 13px", minHeight: 92 }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-soft)", marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 500, color, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)", lineHeight: 1.45, marginTop: 8 }}>
        {detail}
      </p>
    </div>
  );
}

function AccountFact({ label, value, tone }: { label: string; value: string; tone?: AccountActivityTone }) {
  return (
    <div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-soft)", marginBottom: "2px" }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "12px", fontWeight: 500, color: tone ? activityColor(tone) : "var(--color-ink)", lineHeight: 1.2 }}>
        {value}
      </p>
    </div>
  );
}

function AccountCard({
  card,
  index,
  instanceUrl,
  onToggleStar,
}: {
  card: AccountDirectoryCard;
  index: number;
  instanceUrl?: string;
  onToggleStar: (id: string) => void;
}) {
  const statusColor = card.needsAttention ? "var(--color-danger)" : activityColor(card.activityTone);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => { window.location.href = `/accounts/${card.id}`; }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") window.location.href = `/accounts/${card.id}`; }}
      className="group relative block transition-opacity hover:opacity-80"
      style={{
        background: "var(--color-surface)",
        border: card.needsAttention
          ? "0.5px solid color-mix(in srgb, var(--color-danger) 24%, var(--color-border))"
          : "0.5px solid var(--color-border)",
        padding: "11px 13px",
        cursor: "pointer",
        minHeight: 176,
      }}
    >
      <div className="flex items-start justify-between mb-0.5">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-soft)" }}>
          {card.industryLabel}
        </p>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className={card.isStarred ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}>
            <StarButton accountId={card.id} starred={card.isStarred} onToggle={onToggleStar} />
          </div>
          {instanceUrl && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <SalesforceLink instanceUrl={instanceUrl} recordId={card.id} variant="icon" />
            </div>
          )}
        </div>
      </div>

      <p style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 500, color: "var(--color-ink)", margin: "2px 0 10px", lineHeight: 1.2 }}>
        {card.name}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "9px 14px",
        }}
      >
        <AccountFact label="Market" value={card.marketLabel} />
        <AccountFact label="Last touch" value={card.lastActivityLabel} tone={card.activityTone} />
        <AccountFact label="Revenue" value={card.revenueLabel} />
        <AccountFact label="Employees" value={card.employeesLabel} />
      </div>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "10px",
          lineHeight: 1.45,
          color: statusColor,
          marginTop: 12,
          paddingTop: 9,
          borderTop: "0.5px solid var(--color-border)",
        }}
      >
        {card.statusLine}
      </p>
    </div>
  );
}

export default function AccountsListClient({
  instanceUrl,
  initialAccounts,
  initialHasMore,
  initialTotalCount,
  industries,
}: Props) {
  const [accounts, setAccounts] = useState<SFAccount[]>(initialAccounts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("all");
  const [sortBy, setSortBy] = useState<AccountSortBy>("name-asc");
  const [quickFilter, setQuickFilter] = useState<AccountsQuickFilter>("all");
  const [isPending, setIsPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [starred, setStarred] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return getStarred();
  });

  // Track in-flight filter requests so a slower earlier request can't overwrite a newer one
  const filterSeqRef = useRef(0);
  // Track load-more abort controller
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  function toggleStar(id: string) {
    setStarred((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      try { localStorage.setItem("accounts.starred", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Re-query when search/industry/sort changes (debounced 300ms)
  useEffect(() => {
    const seq = ++filterSeqRef.current;
    setIsPending(true);
    setLoadMoreError(null);

    // Cancel any in-flight load-more
    loadMoreAbortRef.current?.abort();

    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ sortBy });
      if (search.trim()) params.set("search", search.trim());
      if (industry !== "all") params.set("industry", industry);

      try {
        const res = await fetch(`/api/accounts?${params}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as { accounts: SFAccount[]; hasMore: boolean; totalCount: number };
        if (seq !== filterSeqRef.current) return; // stale response
        setAccounts(data.accounts);
        setHasMore(data.hasMore);
        setTotalCount(data.totalCount);
      } catch {
        if (seq !== filterSeqRef.current) return;
        // Keep previous data visible on error
      } finally {
        if (seq === filterSeqRef.current) setIsPending(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, industry, sortBy]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);

    const controller = new AbortController();
    loadMoreAbortRef.current = controller;

    const params = new URLSearchParams({ sortBy });
    if (search.trim()) params.set("search", search.trim());
    if (industry !== "all") params.set("industry", industry);

    if (sortBy === "name-asc") {
      const lastName = accounts[accounts.length - 1]?.Name;
      if (lastName) params.set("afterName", lastName);
    } else {
      params.set("offset", String(accounts.length));
    }

    try {
      const res = await fetch(`/api/accounts?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { accounts: SFAccount[]; hasMore: boolean; totalCount: number };
      setAccounts((prev) => [...prev, ...data.accounts]);
      setHasMore(data.hasMore);
      setTotalCount(data.totalCount);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setLoadMoreError("Couldn't load more accounts. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [accounts, search, industry, sortBy, loadingMore, hasMore]);

  // Salesforce's OFFSET cap is 2000 — surface a hint rather than a broken button
  const atOffsetCap = sortBy !== "name-asc" && accounts.length >= 2000;
  const directory = useMemo(
    () => buildAccountsDirectory({ accounts, totalCount, starredIds: starred }),
    [accounts, totalCount, starred],
  );
  const filteredCards = useMemo(
    () => filterAccountsDirectoryCards(directory.cards, quickFilter),
    [directory.cards, quickFilter],
  );
  const quickFilterCounts: Record<AccountsQuickFilter, number> = {
    all: directory.cards.length,
    starred: directory.cards.filter((card) => card.isStarred).length,
    recent: directory.summary.recentlyTouchedCount,
    "needs-attention": directory.summary.needsAttentionCount,
  };

  const selectStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "0.5px solid var(--color-border)",
    color: "var(--color-ink-soft)",
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    padding: "7px 10px",
    outline: "none",
  };

  return (
    <>
      {/* Directory summary */}
      <div
        className="mb-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 6,
        }}
      >
        <SummaryMetric
          label="Directory"
          value={directory.summary.totalCount.toLocaleString()}
          detail={`${directory.summary.visibleCount.toLocaleString()} loaded in this view.`}
        />
        <SummaryMetric
          label="Recently touched"
          value={directory.summary.recentlyTouchedCount.toLocaleString()}
          detail="Activity in the last 30 days."
          tone={directory.summary.recentlyTouchedCount > 0 ? "good" : "neutral"}
        />
        <SummaryMetric
          label="Needs attention"
          value={directory.summary.needsAttentionCount.toLocaleString()}
          detail="Stale activity or multiple data gaps."
          tone={directory.summary.needsAttentionCount > 0 ? "watch" : "neutral"}
        />
        <SummaryMetric
          label="Data gaps"
          value={directory.summary.dataGapCount.toLocaleString()}
          detail="Missing revenue, employees, or market."
          tone={directory.summary.dataGapCount > 0 ? "watch" : "neutral"}
        />
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: "var(--color-ink-soft)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts, industries, regions…"
          className="w-full pl-8 pr-8 py-2 focus:outline-none"
          style={{
            background: "var(--color-surface)",
            border: "0.5px solid var(--color-border)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-body)",
            fontSize: "12px",
          }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent-soft)"; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
        />
        {/* Spinner on pending filter */}
        {isPending && (
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin pointer-events-none"
            viewBox="0 0 24 24" fill="none"
            style={{ color: "var(--color-accent)" }}
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          style={{ ...selectStyle, color: industry === "all" ? "var(--color-ink-soft)" : "var(--color-ink)", minWidth: 140 }}
        >
          <option value="all">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as AccountSortBy)}
          style={{ ...selectStyle, color: "var(--color-ink)", minWidth: 180 }}
        >
          {(Object.keys(SORT_LABELS) as AccountSortBy[]).map((s) => (
            <option key={s} value={s}>{SORT_LABELS[s]}</option>
          ))}
        </select>

        <span
          className="ml-auto"
          style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)", whiteSpace: "nowrap" }}
        >
          Showing {filteredCards.length.toLocaleString()} of {totalCount.toLocaleString()}
        </span>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-1 mb-6" style={{ flexWrap: "wrap" }} role="group" aria-label="Account quick filters">
        {QUICK_FILTERS.map((filter) => {
          const active = quickFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setQuickFilter(filter.id)}
              aria-pressed={active}
              style={{
                padding: "4px 8px",
                border: active ? "0.5px solid var(--color-accent)" : "0.5px solid var(--color-border)",
                borderRadius: 4,
                background: active ? "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface))" : "var(--color-surface)",
                color: active ? "var(--color-ink)" : "var(--color-ink-soft)",
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              {filter.label} · {quickFilterCounts[filter.id].toLocaleString()}
            </button>
          );
        })}
      </div>

      {/* Account grid */}
      {filteredCards.length === 0 && !isPending ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: "var(--color-ink-soft)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--color-ink-soft)" }}>
            No accounts match this view.
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-muted)" }}>
            Try a different keyword, industry, or quick filter.
          </p>
          {(search || industry !== "all" || quickFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setIndustry("all"); setQuickFilter("all"); }}
              style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-accent-text)", background: "none", border: "0.5px solid var(--color-border)", padding: "4px 12px", cursor: "pointer", marginTop: 4 }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            opacity: isPending ? 0.6 : 1,
            transition: "opacity 150ms ease",
          }}
        >
          {filteredCards.map((card, idx) => (
            <AccountCard
              key={card.id}
              card={card}
              index={idx}
              instanceUrl={instanceUrl}
              onToggleStar={toggleStar}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {(hasMore || loadMoreError) && !isPending && accounts.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-8">
          {loadMoreError && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)" }}>
              {loadMoreError}
            </p>
          )}

          {atOffsetCap ? (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", textAlign: "center" }}>
              Salesforce limits offset-based pagination to 2,000 records.{" "}
              <button
                onClick={() => setSortBy("name-asc")}
                style={{ color: "var(--color-accent-text)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: "inherit" }}
              >
                Switch to Name sort
              </button>{" "}
              to load more.
            </p>
          ) : (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "var(--color-ink)",
                background: "var(--color-surface)",
                border: "0.5px solid var(--color-border)",
                padding: "8px 24px",
                cursor: loadingMore ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loadingMore ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color: "var(--color-accent)" }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading…
                </>
              ) : (
                "Load more accounts"
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}
