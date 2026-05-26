"use client";

import { useState, useMemo, useCallback } from "react";
import type { SFAccount } from "@/lib/salesforce";

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getIndustries(accounts: SFAccount[]): string[] {
  const set = new Set<string>();
  for (const a of accounts) {
    if (a.Industry) set.add(a.Industry);
  }
  return Array.from(set).sort();
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

export default function AccountSearch({
  accounts: initialAccounts,
  totalCount,
  instanceUrl,
}: {
  accounts: SFAccount[];
  totalCount: number;
  instanceUrl?: string;
}) {
  const [accounts, setAccounts] = useState<SFAccount[]>(initialAccounts);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allLoaded = accounts.length >= totalCount;

  const industries = useMemo(() => getIndustries(accounts), [accounts]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return accounts.filter((a) => {
      const matchesQuery =
        !q ||
        a.Name.toLowerCase().includes(q) ||
        a.Industry?.toLowerCase().includes(q) ||
        a.BillingCity?.toLowerCase().includes(q) ||
        a.BillingState?.toLowerCase().includes(q);
      const matchesIndustry = !industry || a.Industry === industry;
      return matchesQuery && matchesIndustry;
    });
  }, [accounts, query, industry]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts?offset=${accounts.length}`);
      if (res.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to load accounts");
      const json = await res.json() as { accounts: SFAccount[] };
      setAccounts((prev) => [...prev, ...json.accounts]);
    } catch {
      setError("Failed to load more accounts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [accounts.length]);

  const sfUrl = (id: string) =>
    instanceUrl ? `${instanceUrl}/lightning/r/Account/${id}/view` : null;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--color-ink-soft)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            style={{
              width: "100%",
              paddingLeft: "2.25rem",
              paddingRight: "0.75rem",
              paddingTop: "0.5rem",
              paddingBottom: "0.5rem",
              fontSize: "13px",
              fontFamily: "var(--font-body)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              border: "0.5px solid var(--color-border)",
              outline: "none",
            }}
          />
        </div>
        {industries.length > 0 && (
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{
              fontSize: "13px",
              fontFamily: "var(--font-body)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              border: "0.5px solid var(--color-border)",
              padding: "0.5rem 0.75rem",
              outline: "none",
            }}
          >
            <option value="">All industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        )}
        <p
          className="self-center shrink-0"
          style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}
        >
          {query || industry
            ? `${filtered.length} of ${accounts.length} loaded`
            : `Showing ${accounts.length} of ${totalCount}`}
        </p>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-10 h-10 flex items-center justify-center mb-3"
            style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: "var(--color-ink-soft)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>No accounts found</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", marginTop: "4px" }}>Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const url = sfUrl(a.Id);
            return (
              <AccountCard key={a.Id} account={a} url={url} />
            );
          })}
        </div>
      )}

      {/* Load More */}
      {!allLoaded && (
        <div className="mt-8 flex flex-col items-center gap-2">
          {error && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)" }}>{error}</p>
          )}
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              padding: "8px 20px",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--color-ink)",
              background: "var(--color-surface)",
              border: "0.5px solid var(--color-border)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "opacity 120ms",
            }}
          >
            {loading ? "Loading…" : `Load more (${totalCount - accounts.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

function AccountCard({ account: a, url }: { account: SFAccount; url: string | null }) {
  const [hovered, setHovered] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);
  const [sfHovered, setSfHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--color-surface)",
        border: `0.5px solid ${hovered ? "color-mix(in srgb, var(--color-accent) 40%, var(--color-border))" : "var(--color-border)"}`,
        padding: "20px",
        transition: "border-color 150ms",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <a
          href={`/accounts/${a.Id}`}
          onMouseEnter={() => setLinkHovered(true)}
          onMouseLeave={() => setLinkHovered(false)}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 500,
            color: linkHovered ? "var(--color-accent-text)" : "var(--color-ink)",
            textDecoration: "none",
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            transition: "color 120ms",
          }}
        >
          {a.Name}
        </a>
        <div className="flex items-center gap-1.5 shrink-0">
          {a.Type && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "9px",
                padding: "2px 6px",
                background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                color: "var(--color-accent-text)",
                border: "0.5px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
              }}
            >
              {a.Type}
            </span>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="View in Salesforce"
              onMouseEnter={() => setSfHovered(true)}
              onMouseLeave={() => setSfHovered(false)}
              style={{
                color: "var(--color-ink-soft)",
                opacity: hovered ? (sfHovered ? 1 : 0.7) : 0,
                transition: "opacity 150ms, color 120ms",
              }}
            >
              <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {a.Industry && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)" }}>{a.Industry}</p>
        )}
        {(a.BillingCity || a.BillingState) && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
            {[a.BillingCity, a.BillingState].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
      <div
        className="flex items-center justify-between mt-4 pt-3"
        style={{ borderTop: "0.5px solid var(--color-border)" }}
      >
        <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
          {a.NumberOfEmployees ? `${a.NumberOfEmployees.toLocaleString()} emp.` : ""}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
          {formatCurrency(a.AnnualRevenue)}
        </span>
      </div>
    </div>
  );
}
