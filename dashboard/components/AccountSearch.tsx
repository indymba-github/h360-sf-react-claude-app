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
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
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
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300"
          />
        </div>
        {industries.length > 0 && (
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
          >
            <option value="">All industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        )}
        <p className="text-sm text-gray-400 self-center shrink-0">
          {query || industry
            ? `${filtered.length} of ${accounts.length} loaded`
            : `Showing ${accounts.length} of ${totalCount}`}
        </p>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">No accounts found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const url = sfUrl(a.Id);
            return (
              <div
                key={a.Id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <a
                    href={`/accounts/${a.Id}`}
                    className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-blue-600 transition-colors"
                  >
                    {a.Name}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.Type && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "color-mix(in srgb, var(--color-secondary) 12%, white)", color: "var(--color-secondary)" }}
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
                        className="text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ExternalLinkIcon />
                      </a>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {a.Industry && (
                    <p className="text-xs text-gray-500">{a.Industry}</p>
                  )}
                  {(a.BillingCity || a.BillingState) && (
                    <p className="text-xs text-gray-400">
                      {[a.BillingCity, a.BillingState].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {a.NumberOfEmployees ? `${a.NumberOfEmployees.toLocaleString()} emp.` : ""}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    {formatCurrency(a.AnnualRevenue)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {!allLoaded && (
        <div className="mt-8 flex flex-col items-center gap-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading…" : `Load more (${totalCount - accounts.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
