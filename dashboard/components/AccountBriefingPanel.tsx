"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AgentforceChoices from "@/components/AgentforceChoices";
import AgentforceResults from "@/components/AgentforceResults";
import type { AgentforceRecordChoice, AgentforceResultGroup, AgentforceAggregateSummary } from "@/lib/agentforce-types";

// ── Types ──────────────────────────────────────────────────────────────────

type ChipType = "executive_brief" | "financial_summary" | "activity_summary" | "cross_sell_ideas";
type Status   = "idle" | "loading" | "done" | "error";

interface Chip {
  type: ChipType;
  label: string;
  loadingVerb: string;
}

const CHIPS: Chip[] = [
  { type: "executive_brief",   label: "Executive Brief",          loadingVerb: "Drafting your executive brief" },
  { type: "financial_summary", label: "Financial Summary",        loadingVerb: "Summarizing financials" },
  { type: "activity_summary",  label: "Activity since last meeting", loadingVerb: "Looking back at recent activity" },
  { type: "cross_sell_ideas",  label: "Cross-sell ideas",         loadingVerb: "Searching for cross-sell opportunities" },
];

// ── Cache helpers ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(accountId: string, chipType: ChipType): string {
  return `agentforce.${accountId}.${chipType}`;
}

interface CacheEntry { content: string; generatedAt: string }


function readCache(accountId: string, chipType: ChipType): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(accountId, chipType));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - new Date(entry.generatedAt).getTime() > CACHE_TTL_MS) return null;
    return entry;
  } catch { return null; }
}

function writeCache(accountId: string, chipType: ChipType, content: string): CacheEntry {
  const entry: CacheEntry = { content, generatedAt: new Date().toISOString() };
  try { localStorage.setItem(cacheKey(accountId, chipType), JSON.stringify(entry)); } catch {}
  return entry;
}

// ── Relative time ──────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) !== 1 ? "s" : ""} ago`;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function SparkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ verb }: { verb: string }) {
  return (
    <div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", marginBottom: "16px", fontStyle: "italic" }}>
        {verb}…
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[85, 100, 72, 90, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: "10px",
              width: `${w}%`,
              background: "color-mix(in srgb, var(--color-border) 60%, var(--color-surface))",
              borderRadius: "3px",
              animation: `pulse 1.6s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </div>
  );
}

// ── Markdown renderer ──────────────────────────────────────────────────────

function BriefingMarkdown({ content }: { content: string }) {
  const base: React.CSSProperties = { fontFamily: "var(--font-body)", fontSize: "13px", lineHeight: 1.65, color: "var(--color-ink)" };
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:      ({ children }) => <p style={{ ...base, marginBottom: "10px" }}>{children}</p>,
        h1:     ({ children }) => <p style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 500, color: "var(--color-ink)", marginBottom: "6px", marginTop: "14px" }}>{children}</p>,
        h2:     ({ children }) => <p style={{ ...base, fontWeight: 600, marginBottom: "4px", marginTop: "12px" }}>{children}</p>,
        h3:     ({ children }) => <p style={{ ...base, fontWeight: 500, marginBottom: "2px", marginTop: "8px" }}>{children}</p>,
        ul:     ({ children }) => <ul style={{ ...base, paddingLeft: "16px", marginBottom: "10px", listStyleType: "none" }}>{children}</ul>,
        ol:     ({ children }) => <ol style={{ ...base, paddingLeft: "16px", marginBottom: "10px", listStyleType: "decimal" }}>{children}</ol>,
        li:     ({ children }) => (
          <li style={{ ...base, marginBottom: "4px", display: "flex", gap: "6px", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-accent-text)", marginTop: "2px", flexShrink: 0 }}>•</span>
            <span>{children}</span>
          </li>
        ),
        strong: ({ children }) => <strong style={{ fontWeight: 600, color: "var(--color-ink)" }}>{children}</strong>,
        em:     ({ children }) => <em style={{ fontStyle: "italic", color: "var(--color-accent-text)" }}>{children}</em>,
        hr:     () => <hr style={{ border: "none", borderTop: "0.5px solid var(--color-border)", margin: "12px 0" }} />,
        blockquote: ({ children }) => (
          <blockquote style={{ borderLeft: "2px solid var(--color-accent-soft)", paddingLeft: "12px", marginLeft: 0, color: "var(--color-ink-muted)", fontStyle: "italic" }}>{children}</blockquote>
        ),
        code: ({ children, className }) => {
          const block = className?.includes("language-");
          return block
            ? <code style={{ display: "block", background: "var(--color-ink-deep)", color: "var(--color-paper-bright)", padding: "10px 14px", fontSize: "11px", fontFamily: "var(--font-mono)", overflowX: "auto", whiteSpace: "pre" }}>{children}</code>
            : <code style={{ background: "var(--color-border)", color: "var(--color-ink)", padding: "1px 5px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>{children}</code>;
        },
        table: ({ children }) => <div style={{ overflowX: "auto", marginBottom: "10px" }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>{children}</table></div>,
        th:    ({ children }) => <th style={{ border: "0.5px solid var(--color-border)", background: "var(--color-paper)", color: "var(--color-ink-soft)", padding: "5px 10px", textAlign: "left", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{children}</th>,
        td:    ({ children }) => <td style={{ border: "0.5px solid var(--color-border)", padding: "5px 10px", color: "var(--color-ink)" }}>{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  accountId:   string;
  accountName: string;
}

export default function AccountBriefingPanel({ accountId, accountName }: Props) {
  const [activeChip,   setActiveChip]   = useState<ChipType | null>(null);
  const [status,       setStatus]       = useState<Status>("idle");
  const [content,      setContent]      = useState<string | null>(null);
  const [cacheEntry,   setCacheEntry]   = useState<CacheEntry | null>(null);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [errorCode,    setErrorCode]    = useState<string | null>(null);
  const [pendingChoices,  setPendingChoices]  = useState<AgentforceRecordChoice[] | null>(null);
  const [resultGroups,    setResultGroups]    = useState<AgentforceResultGroup[] | null>(null);
  const [summaryGroups,   setSummaryGroups]   = useState<AgentforceAggregateSummary[] | null>(null);

  const activeChipDef = CHIPS.find(c => c.type === activeChip) ?? null;

  const generate = useCallback(async (chip: Chip, force = false) => {
    // Toggle off if clicking the active chip
    if (!force && chip.type === activeChip && status === "done") {
      setActiveChip(null);
      setContent(null);
      setCacheEntry(null);
      return;
    }

    setActiveChip(chip.type);
    setErrorMsg(null);
    setErrorCode(null);
    setPendingChoices(null);
    setResultGroups(null);
    setSummaryGroups(null);

    // Check cache unless forcing
    if (!force) {
      const cached = readCache(accountId, chip.type);
      if (cached) {
        setContent(cached.content);
        setCacheEntry(cached);
        setStatus("done");
        return;
      }
    }

    setStatus("loading");
    setContent(null);
    setCacheEntry(null);

    try {
      const res  = await fetch("/api/agentforce/brief", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accountId, accountName, chipType: chip.type }),
      });
      const data = await res.json() as { content?: string; type?: string; choices?: AgentforceRecordChoice[]; results?: AgentforceResultGroup[]; summaries?: AgentforceAggregateSummary[]; error?: string; code?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? "Agentforce request failed");
        setErrorCode(data.code ?? null);
        setStatus("error");
        return;
      }

      // Inquire response — agent needs clarification before producing content
      if (data.choices && data.choices.length > 0) {
        setContent(data.content ?? null);
        setPendingChoices(data.choices);
        setStatus("done");
        return;
      }

      if (!data.content && !data.results && !data.summaries) {
        setErrorMsg(data.error ?? "Agentforce request failed");
        setErrorCode(data.code ?? null);
        setStatus("error");
        return;
      }

      if (data.results && data.results.length > 0) {
        setResultGroups(data.results);
      }
      if (data.summaries && data.summaries.length > 0) {
        setSummaryGroups(data.summaries);
      }

      if (data.content) {
        const entry = writeCache(accountId, chip.type, data.content);
        setContent(data.content);
        setCacheEntry(entry);
      }
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      setStatus("error");
    }
  }, [accountId, activeChip, status]);

  const handleBriefingChoiceSelected = useCallback(async (choice: AgentforceRecordChoice) => {
    setPendingChoices(null);
    setResultGroups(null);
    setSummaryGroups(null);
    setStatus("loading");
    setContent(null);
    setCacheEntry(null);
    try {
      const chip = CHIPS.find((c) => c.type === activeChip);
      const res = await fetch("/api/agentforce/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, accountName: choice.title, chipType: activeChip }),
      });
      const data = await res.json() as { content?: string; type?: string; choices?: AgentforceRecordChoice[]; results?: AgentforceResultGroup[]; summaries?: AgentforceAggregateSummary[]; error?: string; code?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Agentforce request failed");
        setErrorCode(data.code ?? null);
        setStatus("error");
        return;
      }
      if (data.choices && data.choices.length > 0) {
        setContent(data.content ?? null);
        setPendingChoices(data.choices);
        setStatus("done");
        return;
      }
      if (!data.content && !data.results && !data.summaries) {
        setErrorMsg(data.error ?? "Agentforce request failed");
        setStatus("error");
        return;
      }
      if (data.results && data.results.length > 0) {
        setResultGroups(data.results);
      }
      if (data.summaries && data.summaries.length > 0) {
        setSummaryGroups(data.summaries);
      }
      if (data.content && chip) {
        const entry = writeCache(accountId, chip.type, data.content);
        setCacheEntry(entry);
        setContent(data.content);
      }
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      setStatus("error");
    }
  }, [accountId, activeChip]);

  return (
    <div className="mb-8">
      {/* Chip row */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const isActive  = chip.type === activeChip;
          const isLoading = isActive && status === "loading";
          return (
            <button
              key={chip.type}
              onClick={() => generate(chip)}
              disabled={status === "loading" && !isActive}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: status === "loading" && !isActive ? "not-allowed" : "pointer",
                transition: "all 120ms ease",
                border: isActive
                  ? "0.5px solid var(--color-accent)"
                  : "0.5px dashed var(--color-accent-soft)",
                background: isActive
                  ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
                  : "transparent",
                color: "var(--color-accent-text)",
                opacity: status === "loading" && !isActive ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (status === "loading" && !isActive) return;
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))";
                  (e.currentTarget as HTMLElement).style.borderStyle = "solid";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.borderStyle = "dashed";
                }
              }}
            >
              <SparkIcon />
              {isLoading ? "Generating…" : chip.label}
            </button>
          );
        })}
      </div>

      {/* Inline content block */}
      {activeChip && status !== "idle" && (
        <div
          style={{
            marginTop: "16px",
            background: "var(--color-surface)",
            border: "0.5px solid var(--color-border)",
            padding: "20px 24px",
          }}
        >
          {/* Block header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-soft)" }}>
              {activeChipDef?.label}
            </p>
            {status === "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {cacheEntry && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)" }}>
                    Generated {relativeTime(cacheEntry.generatedAt)}
                  </span>
                )}
                <button
                  onClick={() => activeChipDef && generate(activeChipDef, true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    color: "var(--color-accent-text)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
                >
                  <RefreshIcon />
                  Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          {status === "loading" && (
            <SkeletonBlock verb={activeChipDef?.loadingVerb ?? "Generating"} />
          )}

          {status === "done" && content && (
            <BriefingMarkdown content={content} />
          )}

          {status === "done" && pendingChoices && pendingChoices.length > 0 && (
            <AgentforceChoices
              choices={pendingChoices}
              disabled={false}
              onSelect={handleBriefingChoiceSelected}
            />
          )}

          {status === "done" && (resultGroups?.length || summaryGroups?.length) ? (
            <AgentforceResults results={resultGroups ?? undefined} summaries={summaryGroups ?? undefined} />
          ) : null}

          {status === "error" && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-danger)" }}>
              {errorCode === "NOT_CONFIGURED"
                ? "Agentforce isn't configured for this workspace. Set SF_AGENT_ID, SF_AGENT_CLIENT_ID, and SF_AGENT_CLIENT_SECRET to enable."
                : (errorMsg ?? "Agentforce is not available right now. Try again in a moment.")}
            </p>
          )}

          {/* Footer */}
          {status === "done" && (
            <div
              style={{
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "0.5px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <SparkIcon />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)" }}>
                Powered by Agentforce
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
