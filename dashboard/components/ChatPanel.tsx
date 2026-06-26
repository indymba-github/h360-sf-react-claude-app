"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getConfiguredProviders, clearProvidersCache } from "@/lib/providers";
import { getAgentProfiles, getActiveAgentProfile, setActiveAgentProfile as setActiveAgentProfileLib, type AgentProfile } from "@/lib/agents";
import AgentforceChoices from "@/components/AgentforceChoices";
import AgentforceResults from "@/components/AgentforceResults";
import type { AgentforceRecordChoice, AgentforceResultGroup, AgentforceAggregateSummary } from "@/lib/agentforce-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DASHBOARD_PROMPTS,
  ACCOUNTS_PROMPTS,
  accountDetailPrompts,
  type SuggestedPrompt,
} from "@/lib/prompts";
import { useAiContext } from "@/lib/use-ai-context";
import MicButton from "@/components/MicButton";
import type { RenderDirective } from "@/lib/render-directives";
import { findModelByApiName } from "@/lib/salesforce-models-catalog";
import {
  RESPONSE_PATH_LABELS,
  getNextResponseDescription,
  getResponsePathDetail,
  getRouteReceiptText,
  getSelectableResponsePaths,
  normalizeResponsePath,
  type ResponsePath,
} from "@/lib/response-path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AccountContext {
  accountId: string;
  accountName: string;
  industry?: string | null;
  annualRevenue?: number | null;
  type?: string | null;
}

interface ToolCall {
  name: string;
  label: string;
}

interface WriteResult {
  success: boolean;
  url: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolIndicators?: ToolIndicator[];
  writeResult?: WriteResult;
  isProposal?: boolean;
  followUps?: string[];
  choices?: AgentforceRecordChoice[];
  choiceResolved?: boolean;
  results?: AgentforceResultGroup[];
  summaries?: AgentforceAggregateSummary[];
  consultedAgentforce?: boolean;
  trustLayerMode?: boolean;
  modelUsed?: string;
  contextPrefetched?: boolean;
  contextSource?: "mcp" | "rest" | "none";
  summaryAgentUsed?: boolean;
  responseBaseMode?: McpMode;
  responsePath?: ResponsePath;
}

// SSE event shapes coming from the server
interface SseToken         { type: "token";         text: string }
interface SseStatus        { type: "status";        text: string }
interface SseDone          { type: "done";           toolCalls: ToolCall[]; render?: RenderDirective | null; consultedAgentforce?: boolean; summaryAgentUsed?: boolean }
interface SseError         { type: "error";          error: string }
interface SseWriteComplete { type: "write_complete"; toolName: string; success: boolean; url: string | null }
interface SseToolStart     { type: "tool_start";    toolId: string; toolName: string }
interface SseToolResult    { type: "tool_result";   toolId: string; toolName: string; recordCount: number | null; error: boolean }
type SseEvent = SseToken | SseStatus | SseDone | SseError | SseWriteComplete | SseToolStart | SseToolResult;

const WRITE_VERB_RE    = /\b(create|add|log|update|modify|change|schedule|record)\b/i;
const CONFIRM_PHRASE_RE = /\b(shall I|should I|would you like|want me to|confirm|go ahead|proceed|ready to)\b/i;

function detectProposal(text: string, hasToolCalls: boolean): boolean {
  if (hasToolCalls) return false;
  return WRITE_VERB_RE.test(text) && CONFIRM_PHRASE_RE.test(text);
}

function parseFollowUps(text: string): { displayText: string; followUps: string[] } {
  const match = text.match(/```follow-ups\n([\s\S]*?)\n```\s*$/);
  if (!match) return { displayText: text, followUps: [] };
  const followUps = match[1].split("\n").map((l) => l.trim()).filter(Boolean);
  const displayText = text.slice(0, match.index).trimEnd();
  return { displayText, followUps };
}

// ── Panel constants ────────────────────────────────────────────────────────

const DEFAULT_WIDTH_PCT = 0.15;
const MIN_WIDTH_PCT     = 0.10;
const MAX_WIDTH_PCT     = 0.40;
const COLLAPSED_WIDTH   = 40;

const LS_WIDTH_KEY    = "ai-panel.width-pct";
const LS_PROVIDER_KEY = "ai-panel.provider";
const SS_MESSAGES_KEY = "sf-chat-messages";

// ── Context helpers ────────────────────────────────────────────────────────

function getContextString(pathname: string, accountName?: string): string {
  if (/^\/accounts\/[^/]+/.test(pathname) && accountName) return accountName;
  if (pathname.startsWith("/accounts")) return "Browsing accounts";
  if (pathname.startsWith("/settings")) return "General help";
  return "Your book of business";
}

function getPromptsForPathDefaults(pathname: string, accountName?: string): SuggestedPrompt[] {
  if (/^\/accounts\/[^/]+/.test(pathname) && accountName) return accountDetailPrompts(accountName);
  if (pathname.startsWith("/accounts")) return ACCOUNTS_PROMPTS;
  return DASHBOARD_PROMPTS;
}

function getPromptsFromStorage(pathname: string): SuggestedPrompt[] | null {
  try {
    const raw = localStorage.getItem("prompts.library");
    if (!raw) return null;
    type LibEntry = { tab: string; text: string; visible: boolean };
    const lib = JSON.parse(raw) as LibEntry[];
    const tab =
      /^\/accounts\/[^/]+/.test(pathname) ? "account"
      : pathname.startsWith("/accounts") ? "accounts"
      : pathname.startsWith("/settings") ? "settings"
      : "dashboard";
    const visible = lib.filter((p) => p.tab === tab && p.visible);
    if (visible.length > 0) return visible.map((p) => ({ label: p.text, prompt: p.text }));
  } catch {}
  return null;
}

// ── Tool icon ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ToolIcon({ name }: { name: string }) {
  if (name.includes("search") || name.includes("soql")) {
    return (
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    );
  }
  if (name.includes("opportunit")) {
    return (
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    );
  }
  if (name.includes("contact")) {
    return (
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    );
  }
  if (name.includes("case")) {
    return (
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    );
  }
  if (name.includes("pipeline") || name.includes("activity")) {
    return (
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
  );
}

// ── Sparkle icon ───────────────────────────────────────────────────────────

function SparkleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ color: "var(--color-accent)", flexShrink: 0 }}
    >
      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
    </svg>
  );
}

// ── Markdown renderer ──────────────────────────────────────────────────────

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:          ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        h1:         ({ children }) => <p className="font-bold text-sm mt-3 mb-1 first:mt-0">{children}</p>,
        h2:         ({ children }) => <p className="font-semibold text-sm mt-2 mb-1 first:mt-0">{children}</p>,
        h3:         ({ children }) => <p className="font-medium mt-1.5 mb-0.5 first:mt-0">{children}</p>,
        ul:         ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 pl-1">{children}</ul>,
        ol:         ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 pl-1">{children}</ol>,
        li:         ({ children }) => <li className="leading-snug">{children}</li>,
        strong:     ({ children }) => <strong className="font-semibold">{children}</strong>,
        em:         ({ children }) => <em className="italic">{children}</em>,
        pre:        ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 pl-3 italic my-2" style={{ borderColor: "var(--color-border)", color: "var(--color-ink-muted)" }}>
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3" style={{ borderColor: "var(--color-border)" }} />,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className="block rounded p-3 text-xs font-mono overflow-x-auto my-2 whitespace-pre" style={{ background: "var(--color-ink-deep)", color: "var(--color-paper-bright)" }}>
              {children}
            </code>
          ) : (
            <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: "var(--color-border)", color: "var(--color-ink)" }}>
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-medium text-xs uppercase tracking-wide" style={{ border: "0.5px solid var(--color-border)", background: "var(--color-paper)", color: "var(--color-ink-soft)" }}>{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1" style={{ border: "0.5px solid var(--color-border)" }}>{children}</td>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Tool call badges ───────────────────────────────────────────────────────

// ── Tool phase indicator ───────────────────────────────────────────────────

type ToolPhase = "querying" | "complete" | "analyzing" | "settled";

interface ToolIndicator {
  toolId:      string;
  toolName:    string;
  phase:       ToolPhase;
  recordCount: number | null;
  label:       string;
}

// Phase labels, adapted per tool
const QUERYING_LABELS: Record<string, string> = {
  soqlQuery:                "Querying Salesforce…",
  sf_run_soql:              "Querying Salesforce…",
  sf_list_accounts:         "Looking up accounts…",
  sf_get_account:           "Looking up account…",
  sf_search_records:        "Searching…",
  sf_get_opportunities:     "Loading pipeline…",
  sf_get_pipeline_summary:  "Calculating pipeline…",
  sf_get_contacts:          "Loading contacts…",
  sf_get_cases:             "Checking cases…",
  sf_get_recent_activity:   "Reviewing activity…",
  sf_create_task:           "Creating task…",
  sf_log_activity:          "Logging activity…",
  sf_update_record:         "Updating record…",
  sf_create_record:         "Creating record…",
  ask_agentforce:           "Asking Agentforce…",
};

function completeLabel(toolName: string, count: number | null): string {
  const n = count ?? 0;
  if (toolName === "soqlQuery" || toolName === "sf_run_soql") return `Got ${n} record${n !== 1 ? "s" : ""}`;
  if (toolName === "sf_list_accounts" || toolName === "sf_get_account") return `Found ${n} account${n !== 1 ? "s" : ""}`;
  if (toolName === "sf_get_opportunities") return `Got ${n} opportunit${n !== 1 ? "ies" : "y"}`;
  if (toolName === "sf_get_pipeline_summary") return `Aggregated ${n} record${n !== 1 ? "s" : ""}`;
  if (toolName === "sf_get_contacts") return `Found ${n} contact${n !== 1 ? "s" : ""}`;
  if (toolName === "sf_get_cases") return `Found ${n} case${n !== 1 ? "s" : ""}`;
  if (toolName === "sf_get_recent_activity") return `Found ${n} update${n !== 1 ? "s" : ""}`;
  if (toolName === "sf_search_records") return `Found ${n} match${n !== 1 ? "es" : ""}`;
  if (toolName === "sf_create_task" || toolName === "sf_log_activity" || toolName === "sf_create_record") return "Done";
  if (toolName === "sf_update_record") return "Updated";
  return `Done`;
}

function settledLabel(toolName: string, count: number | null): string {
  if (toolName === "sf_create_task")        return "Created task";
  if (toolName === "sf_log_activity")       return "Logged activity";
  if (toolName === "sf_update_record")      return "Updated record";
  if (toolName === "sf_create_record")      return "Created record";
  const n = count ?? 0;
  const src = "Salesforce data";
  if (n > 0) return `Used ${src} · ${n} record${n !== 1 ? "s" : ""}`;
  return `Used ${src}`;
}

function ToolPhaseIndicator({ indicator }: { indicator: ToolIndicator }) {
  const active   = indicator.phase === "querying" || indicator.phase === "analyzing";
  const complete = indicator.phase === "complete";
  const settled  = indicator.phase === "settled";

  return (
    <div
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            "6px",
        padding:        "3px 9px",
        background:     "var(--color-surface)",
        border:         "0.5px solid var(--color-border)",
        fontSize:       "11px",
        fontFamily:     "var(--font-body)",
        color:          settled ? "var(--color-ink-soft)" : "var(--color-ink-muted)",
        position:       "relative",
        overflow:       "hidden",
        borderRadius:   "3px",
      }}
    >
      {/* Shimmer sweep during active phases */}
      {active && (
        <span
          aria-hidden="true"
          style={{
            position:    "absolute",
            inset:       0,
            background:  "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-accent) 10%, transparent) 50%, transparent 100%)",
            animation:   "toolShimmer 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Dot icon */}
      <span
        style={{
          width:       "6px",
          height:      "6px",
          borderRadius:"50%",
          background:  complete ? "var(--color-success)" : settled ? "var(--color-border)" : "var(--color-accent)",
          flexShrink:  0,
          animation:   active ? "toolPulse 1.2s ease-in-out infinite" : "none",
          transition:  "background 200ms ease",
        }}
      />

      {/* Label with crossfade */}
      <span style={{ transition: "opacity 150ms ease" }}>
        {indicator.label}
      </span>
    </div>
  );
}

function ActiveToolIndicators({ indicators }: { indicators: ToolIndicator[] }) {
  if (indicators.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px", maxWidth: "90%" }}>
      {indicators.map((ind) => (
        <ToolPhaseIndicator key={ind.toolId} indicator={ind} />
      ))}
    </div>
  );
}

// ── Write result banner ────────────────────────────────────────────────────

function WriteResultBanner({ result }: { result: WriteResult }) {
  if (result.success) {
    return (
      <div
        className="mt-2 flex items-center gap-2 text-xs px-2.5 py-1.5"
        style={{
          color: "var(--color-success)",
          background: "color-mix(in srgb, var(--color-success) 8%, var(--color-surface))",
          border: "0.5px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))",
        }}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        <span className="font-medium">Saved to Salesforce</span>
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 underline underline-offset-2"
            style={{ color: "var(--color-success)" }}
          >
            View record
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        )}
      </div>
    );
  }
  return (
    <div
      className="mt-2 flex items-center gap-2 text-xs px-2.5 py-1.5"
      style={{
        color: "var(--color-danger)",
        background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
        border: "0.5px solid color-mix(in srgb, var(--color-danger) 25%, var(--color-border))",
      }}
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <span className="font-medium">Write operation failed</span>
    </div>
  );
}

// ── Three-dot loading animation ────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex gap-1 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: "var(--color-ink-soft)" }} />
      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: "var(--color-ink-soft)" }} />
      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--color-ink-soft)" }} />
    </div>
  );
}

// ── In-progress bubble ─────────────────────────────────────────────────────

function InProgressBubble({ content, status }: { content: string; status: string | null }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {status && (
        <div className="flex items-center gap-1.5 text-xs px-1" style={{ color: "var(--color-ink-soft)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: "var(--color-accent)" }} />
          {status}
        </div>
      )}
      <div
        className="max-w-[90%] px-3.5 py-2.5 text-sm"
        style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", color: "var(--color-ink)" }}
      >
        {content ? (
          <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <LoadingDots />
        )}
      </div>
    </div>
  );
}

// ── Session expired banner ─────────────────────────────────────────────────

function SessionExpiredBanner() {
  return (
    <div
      className="mx-4 mb-3 px-3 py-2.5 text-xs"
      style={{
        background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))",
        border: "0.5px solid color-mix(in srgb, var(--color-warning) 30%, var(--color-border))",
        color: "var(--color-warning)",
      }}
    >
      <p className="font-medium mb-1">Salesforce session expired</p>
      <a href="/api/auth/login" className="underline" style={{ color: "var(--color-warning)" }}>
        Re-connect to Salesforce →
      </a>
    </div>
  );
}

// ── MCP not-connected banner ───────────────────────────────────────────────

function McpConnectPrompt({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      className="mx-4 mb-3 px-3 py-3 text-xs"
      style={{
        background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))",
        border: "0.5px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border))",
        color: "var(--color-ink-muted)",
      }}
    >
      <p className="font-medium mb-1" style={{ color: "var(--color-ink)" }}>Salesforce MCP not connected</p>
      <p className="mb-2">Authorise the Hosted MCP app before using it.</p>
      <div className="flex items-center gap-2">
        <a
          href="/api/auth/mcp-login"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
        >
          Connect MCP →
        </a>
        <button
          onClick={onCancel}
          className="underline"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Provider toggle ────────────────────────────────────────────────────────

type McpMode = "local" | "hosted" | "agentforce";

function McpModeToggle({
  mode,
  switching,
  onSwitch,
  available,
}: {
  mode: McpMode;
  switching: boolean;
  onSwitch: (m: McpMode) => void;
  available: McpMode[];
}) {
  if (available.length <= 1) return null;
  return (
    <div className="flex items-center gap-0.5">
      {available.map((m) => (
        <button
          key={m}
          onClick={() => onSwitch(m)}
          disabled={switching}
          style={{
            fontSize: "8px",
            padding: "2px 5px",
            fontFamily: "var(--font-body)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: mode === m ? "0.5px solid var(--color-accent)" : "0.5px solid transparent",
            background: mode === m ? "var(--color-surface)" : "transparent",
            color: mode === m ? "var(--color-ink)" : "var(--color-ink-soft)",
            cursor: switching ? "not-allowed" : "pointer",
            transition: "all 100ms ease",
            opacity: switching ? 0.5 : 1,
          }}
        >
          {m === "agentforce" ? "Agentforce" : m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}


function ResponsePathControl({
  baseMode,
  path,
  onChange,
}: {
  baseMode: McpMode;
  path: ResponsePath;
  onChange: (path: ResponsePath) => void;
}) {
  if (baseMode === "agentforce") return null;

  const normalizedPath = normalizeResponsePath(baseMode, path);
  const selectable = getSelectableResponsePaths(baseMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <p
        style={{
          fontSize: "8px",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-ink-soft)",
        }}
      >
        Response path
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }} role="group" aria-label="Response path">
        {selectable.map((option) => {
          const active = normalizedPath === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              title={getResponsePathDetail(baseMode, option)}
              style={{
                padding: "3px 7px",
                border: active ? "0.5px solid var(--color-accent)" : "0.5px solid var(--color-border)",
                borderRadius: "4px",
                background: active ? "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface))" : "transparent",
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                color: active ? "var(--color-ink)" : "var(--color-ink-soft)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {RESPONSE_PATH_LABELS[option]}
            </button>
          );
        })}
      </div>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "10px",
          color: "var(--color-ink-soft)",
          lineHeight: 1.35,
        }}
      >
        {getNextResponseDescription(baseMode, normalizedPath)}
      </p>
    </div>
  );
}

function ResponsePathFooter({
  baseMode,
  path,
  modelUsed,
  contextPrefetched,
  contextSource,
}: {
  baseMode: McpMode;
  path: ResponsePath;
  modelUsed?: string;
  contextPrefetched?: boolean;
  contextSource?: "mcp" | "rest" | "none";
}) {
  const modelLabel = modelUsed ? (findModelByApiName(modelUsed)?.label ?? "Salesforce Models API") : undefined;
  const label = getRouteReceiptText({
    baseMode,
    path,
    modelLabel,
    contextPrefetched,
    contextSource,
  });

  return (
    <div
      style={{
        marginTop: "6px",
        paddingTop: "6px",
        borderTop: "0.5px solid var(--color-border)",
        fontFamily: "var(--font-body)",
        fontSize: "10px",
        color: "var(--color-ink-soft)",
        display: "flex",
        gap: "6px",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontSize: "8px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-ink-soft)",
        }}
      >
        Route
      </span>
      <span>{label}</span>
    </div>
  );
}

// ── Agent picker row ──────────────────────────────────────────────────────

function AgentPickerRow({
  profiles,
  activeProfile,
  pickerOpen,
  onTogglePicker,
  onClosePicker,
  onSwitch,
}: {
  profiles: AgentProfile[];
  activeProfile: AgentProfile | null;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
  onSwitch: (profile: AgentProfile) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        onClosePicker();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen, onClosePicker]);

  const LightningIcon = () => (
    <svg width={9} height={9} viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-accent)", flexShrink: 0 }}>
      <path d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" />
    </svg>
  );

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    color: "var(--color-ink-soft)",
  };

  // Zero profiles
  if (profiles.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <LightningIcon />
        <span style={labelStyle}>No agent configured —</span>
        <a
          href="/settings#agentforce"
          style={{ ...labelStyle, color: "var(--color-accent-text)", textDecoration: "underline" }}
        >
          Manage agents
        </a>
      </div>
    );
  }

  // Single profile — no dropdown needed
  if (profiles.length === 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <LightningIcon />
        <span style={labelStyle}>Active agent:</span>
        <span style={{ ...labelStyle, color: "var(--color-ink-muted)" }}>{activeProfile?.label ?? profiles[0].label}</span>
      </div>
    );
  }

  // Multiple profiles — dropdown picker
  return (
    <div ref={rowRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
      <LightningIcon />
      <span style={labelStyle}>Active agent:</span>
      <button
        onClick={onTogglePicker}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          color: "var(--color-ink)",
          background: pickerOpen ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))" : "transparent",
          border: pickerOpen ? "0.5px solid var(--color-accent-soft)" : "0.5px solid transparent",
          padding: "1px 5px 1px 5px",
          cursor: "pointer",
          transition: "background 100ms ease, border-color 100ms ease",
        }}
        onMouseEnter={(e) => {
          if (!pickerOpen) (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))";
        }}
        onMouseLeave={(e) => {
          if (!pickerOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        {activeProfile?.label ?? "—"}
        <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: "var(--color-ink-soft)", marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {pickerOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            minWidth: 160,
            background: "var(--color-surface)",
            border: "0.5px solid var(--color-border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          {profiles.map((p) => {
            const isActive = p.id === activeProfile?.id;
            return (
              <button
                key={p.id}
                onClick={() => onSwitch(p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 10px",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: isActive ? "var(--color-ink)" : "var(--color-ink-muted)",
                  fontWeight: isActive ? 500 : 400,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 80ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: isActive ? "var(--color-accent)" : "transparent",
                  border: isActive ? "none" : "1px solid var(--color-border)",
                }} />
                {p.label}
              </button>
            );
          })}
          <div style={{ borderTop: "0.5px solid var(--color-border)", padding: "5px 10px" }}>
            <a
              href="/settings#agentforce"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "var(--color-ink-soft)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-accent-text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-soft)"; }}
            >
              Manage agents…
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SSE stream reader ──────────────────────────────────────────────────────

async function* readSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            yield JSON.parse(json) as SseEvent;
          } catch {
            // skip malformed event
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatPanel({
  accountContext: accountContextProp,
  initialMcpMode = "local",
  hasMcpToken = false,
  onRender,
}: {
  accountContext?: AccountContext;
  initialMcpMode?: McpMode;
  hasMcpToken?: boolean;
  onRender?: (directive: RenderDirective | null) => void;
}) {
  const pathname = usePathname();

  const contextString   = getContextString(pathname, accountContextProp?.accountName);
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>(() =>
    getPromptsForPathDefaults(pathname, accountContextProp?.accountName)
  );

  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [streamingContent, setStreaming]  = useState("");
  const [streamingStatus, setStatus]      = useState<string | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<ToolIndicator[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [isInterim,   setIsInterim]       = useState(false);
  const [micDenied,   setMicDenied]       = useState(false);
  const interimBaseRef    = useRef(""); // text that was in input before recording started
  const pendingSubmitRef  = useRef(false); // true when recording stopped — submit on next final result
  const [mcpMode, setMcpMode]             = useState<McpMode>(initialMcpMode);
  const [mcpSwitching, setMcpSwitching]   = useState(false);
  const [availableProviders, setAvailableProviders] = useState<McpMode[]>([]);
  const [providersLoaded, setProvidersLoaded]       = useState(false);
  const [activeAgentProfile, setActiveAgentProfile] = useState<AgentProfile | null>(null);
  const [agentProfiles, setAgentProfiles]           = useState<AgentProfile[]>([]);
  const [agentPickerOpen, setAgentPickerOpen]       = useState(false);
  const [responsePath, setResponsePath]             = useState<ResponsePath>("default");
  const [showMcpPrompt, setShowMcpPrompt] = useState(false);
  const [panelWidthPct, setPanelWidthPct] = useState(DEFAULT_WIDTH_PCT);
  const [collapsed, setCollapsed]         = useState(false);
  const [isResizing, setIsResizing]       = useState(false);

  const lastWidthPctRef    = useRef(DEFAULT_WIDTH_PCT);
  const currentWidthPctRef = useRef(DEFAULT_WIDTH_PCT);
  const pendingWriteRef    = useRef<WriteResult | null>(null);
  const isDragging         = useRef(false);
  const prevPathnameRef    = useRef<string | null>(null);
  const accountContextRef  = useRef(accountContextProp);
  const messagesRef        = useRef<Message[]>([]);
  const conversationIdRef  = useRef(`chat-${Date.now()}`);

  const { pendingPrompt, clearPendingPrompt } = useAiContext();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const effectiveResponsePath = normalizeResponsePath(mcpMode, responsePath);

  // Load prompts from localStorage after hydration to avoid server/client mismatch
  useEffect(() => {
    const fromStorage = getPromptsFromStorage(pathname);
    if (fromStorage) setSuggestedPrompts(fromStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs current
  useEffect(() => {
    accountContextRef.current = accountContextProp;
  }, [accountContextProp]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep width ref in sync
  useEffect(() => {
    currentWidthPctRef.current = panelWidthPct;
  }, [panelWidthPct]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamingContent]);

  // Clear conversation when navigating to a different route.
  // prevPathnameRef starts null so the first run just records the initial pathname without clearing.
  useEffect(() => {
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname;
      return;
    }
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setMessages([]);
      setSessionExpired(false);
      setShowMcpPrompt(false);
      conversationIdRef.current = `chat-${Date.now()}`;
      try { sessionStorage.removeItem(SS_MESSAGES_KEY); } catch {}
    }
  }, [pathname]);

  // Fire pending prompt from action chips — expand panel and send
  useEffect(() => {
    if (!pendingPrompt) return;
    clearPendingPrompt();
    setCollapsed(false);
    setPanelWidthPct((prev) => (prev < MIN_WIDTH_PCT + 0.01 ? DEFAULT_WIDTH_PCT : prev));
    // Defer slightly so panel is expanded before send triggers scroll-to-bottom
    setTimeout(() => send(pendingPrompt), 50);
  // send is stable (useCallback with stable deps) — including it would require memoizing with all its deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, clearPendingPrompt]);

  // Listen for 'Ask AI about this' events dispatched by rendered components
  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ question: string; accountId?: string }>;
      const question = evt.detail?.question;
      if (!question) return;
      setCollapsed(false);
      setPanelWidthPct((prev) => (prev < MIN_WIDTH_PCT + 0.01 ? DEFAULT_WIDTH_PCT : prev));
      setTimeout(() => send(question), 50);
    };
    window.addEventListener("chat:ask", handler);
    return () => window.removeEventListener("chat:ask", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted state on mount (client-only)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SS_MESSAGES_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {}
    try {
      const savedMode = localStorage.getItem(LS_PROVIDER_KEY);
      if (savedMode === "local" || savedMode === "hosted" || savedMode === "agentforce") {
        setMcpMode(savedMode);
      }
    } catch {}
    try {
      const savedPct = localStorage.getItem(LS_WIDTH_KEY);
      if (savedPct) {
        const pct = parseFloat(savedPct);
        if (!isNaN(pct) && pct >= MIN_WIDTH_PCT && pct <= MAX_WIDTH_PCT) {
          setPanelWidthPct(pct);
          lastWidthPctRef.current = pct;
          currentWidthPctRef.current = pct;
        }
      }
    } catch {}

    getConfiguredProviders().then((list) => {
      setAvailableProviders(list as McpMode[]);
      setProvidersLoaded(true);
    });

    const onProviderChanged = () => {
      clearProvidersCache();
      getConfiguredProviders().then((list) => setAvailableProviders(list as McpMode[]));
    };
    window.addEventListener("default-provider-changed", onProviderChanged);

    // Load agent profiles and track the active one
    getAgentProfiles().then((profiles) => {
      setAgentProfiles(profiles);
      setActiveAgentProfile(getActiveAgentProfile(profiles));
    });

    const onAgentActiveChanged = () => {
      getAgentProfiles().then((profiles) => {
        setAgentProfiles(profiles);
        setActiveAgentProfile(getActiveAgentProfile(profiles));
      });
    };
    window.addEventListener("agentforce-active-changed", onAgentActiveChanged);
    window.addEventListener("agentforce-profiles-changed", onAgentActiveChanged);

    return () => {
      window.removeEventListener("default-provider-changed", onProviderChanged);
      window.removeEventListener("agentforce-active-changed", onAgentActiveChanged);
      window.removeEventListener("agentforce-profiles-changed", onAgentActiveChanged);
    };
  }, []);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      try { sessionStorage.setItem(SS_MESSAGES_KEY, JSON.stringify(messages)); } catch {}
    }
  }, [messages]);

  // Persist provider
  useEffect(() => {
    try { localStorage.setItem(LS_PROVIDER_KEY, mcpMode); } catch {}
  }, [mcpMode]);

  useEffect(() => {
    setResponsePath((current) => normalizeResponsePath(mcpMode, current));
  }, [mcpMode]);

  // Persist width when not collapsed
  useEffect(() => {
    if (!collapsed) {
      try { localStorage.setItem(LS_WIDTH_KEY, String(panelWidthPct)); } catch {}
    }
  }, [panelWidthPct, collapsed]);

  // Publish live panel width so overlays (RenderSlot) can avoid covering it
  useEffect(() => {
    const widthValue = collapsed
      ? `${COLLAPSED_WIDTH}px`
      : `${panelWidthPct * 100}vw`;
    document.documentElement.style.setProperty('--ai-panel-width', widthValue);
  }, [panelWidthPct, collapsed]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--ai-panel-width');
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);

    const startX = e.clientX;
    const startPct = currentWidthPctRef.current;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const vw = window.innerWidth;
      const delta = startX - ev.clientX;
      const newPct = startPct + delta / vw;

      // Snap to collapsed below threshold
      if (newPct < MIN_WIDTH_PCT - 0.02) {
        isDragging.current = false;
        setIsResizing(false);
        lastWidthPctRef.current = currentWidthPctRef.current;
        setCollapsed(true);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        return;
      }

      const clamped = Math.max(MIN_WIDTH_PCT, Math.min(MAX_WIDTH_PCT, newPct));
      setPanelWidthPct(clamped);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [collapsed]);

  const handleCollapse = useCallback(() => {
    lastWidthPctRef.current = currentWidthPctRef.current;
    setCollapsed(true);
  }, []);

  const handleExpand = useCallback(() => {
    setCollapsed(false);
    setPanelWidthPct(lastWidthPctRef.current);
  }, []);

  const handleModeSwitch = useCallback(async (newMode: McpMode) => {
    if (newMode === mcpMode || mcpSwitching) return;

    if (newMode === "hosted" && !hasMcpToken) {
      setShowMcpPrompt(true);
      return;
    }

    setMcpSwitching(true);
    try {
      if (mcpMode === "agentforce") {
        await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end" }),
        }).catch(() => {});
      }

      const res = await fetch("/api/chat/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setMcpMode(newMode);
        setResponsePath((current) => normalizeResponsePath(newMode, current));
        setMessages([]);
        setSessionExpired(false);
        setShowMcpPrompt(false);
        try { sessionStorage.removeItem(SS_MESSAGES_KEY); } catch {}
      }
    } finally {
      setMcpSwitching(false);
    }
  }, [mcpMode, mcpSwitching, hasMcpToken]);

  const sendAgentforce = useCallback(async (
    trimmed: string,
    route?: { baseMode: McpMode; path: ResponsePath },
  ) => {
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          text: trimmed,
          accountContext: accountContextRef.current,
          agentId: activeAgentProfile?.agentId,
        }),
      });
      const data = await res.json() as { reply?: string; type?: string; choices?: AgentforceRecordChoice[]; results?: AgentforceResultGroup[]; summaries?: AgentforceAggregateSummary[]; render?: RenderDirective | null; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Agentforce request failed");
      if (data.render && onRender) onRender(data.render);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply ?? "",
        choices: data.choices,
        choiceResolved: false,
        results: data.results,
        summaries: data.summaries,
        responseBaseMode: route?.baseMode ?? "agentforce",
        responsePath: route?.path ?? "default",
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
      }]);
    } finally {
      setStreaming("");
      setStatus(null);
      setLoading(false);
    }
  }, [activeAgentProfile, onRender]);

  const handleChoiceSelected = useCallback(async (parentMessage: Message, choice: AgentforceRecordChoice) => {
    setMessages((prev) => prev.map((m) => m === parentMessage ? { ...m, choiceResolved: true } : m));
    setMessages((prev) => [...prev, { role: "user", content: choice.title }]);
    setLoading(true);
    setStatus("Agentforce is working…");
    setStreaming("");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          text: choice.title,
          accountContext: accountContextRef.current,
          agentId: activeAgentProfile?.agentId,
        }),
      });
      const data = await res.json() as { reply?: string; type?: string; choices?: AgentforceRecordChoice[]; results?: AgentforceResultGroup[]; summaries?: AgentforceAggregateSummary[]; render?: RenderDirective | null; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Agentforce request failed");
      if (data.render && onRender) onRender(data.render);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply ?? "",
        choices: data.choices,
        choiceResolved: false,
        results: data.results,
        summaries: data.summaries,
        responseBaseMode: parentMessage.responseBaseMode ?? "agentforce",
        responsePath: parentMessage.responsePath ?? "default",
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
      }]);
    } finally {
      setStreaming("");
      setStatus(null);
      setLoading(false);
    }
  }, [activeAgentProfile, onRender]);

  const handleAgentSwitch = useCallback(async (profile: AgentProfile) => {
    if (profile.id === activeAgentProfile?.id) {
      setAgentPickerOpen(false);
      return;
    }
    // Best-effort session cleanup — don't block the switch on failure
    fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    }).catch(() => {});
    setActiveAgentProfile(profile);
    setActiveAgentProfileLib(profile.id);
    setAgentPickerOpen(false);
  }, [activeAgentProfile]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setSessionExpired(false);
      const userMsg: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setStreaming("");
      setStatus(mcpMode === "agentforce" || effectiveResponsePath === "agentforce-direct" ? "Agentforce is working…" : null);
      setActiveIndicators([]);
      pendingWriteRef.current = null;

      if (mcpMode === "agentforce" || effectiveResponsePath === "agentforce-direct") {
        await sendAgentforce(trimmed, {
          baseMode: mcpMode,
          path: mcpMode === "agentforce" ? "default" : "agentforce-direct",
        });
        return;
      }

      const outgoingMessages = [...messagesRef.current, userMsg];

      // Trust Layer mode: non-streaming JSON response
      if (effectiveResponsePath === "trust-layer") {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: outgoingMessages, accountContext: accountContextRef.current, trustLayerMode: true }),
          });
          const data = await res.json() as { text?: string; modelUsed?: string; error?: string; contextPrefetched?: boolean; contextSource?: "mcp" | "rest" | "none" };
          if (!res.ok || data.error) {
            if (res.status === 401 || data.error === "SF_SESSION_EXPIRED") {
              setSessionExpired(true);
            } else {
              setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${data.error ?? "Trust Layer request failed"}` }]);
            }
          } else {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: data.text ?? "",
              trustLayerMode: true,
              modelUsed: data.modelUsed,
              contextPrefetched: data.contextPrefetched,
              contextSource: data.contextSource,
              responseBaseMode: mcpMode,
              responsePath: "trust-layer",
            }]);
          }
        } catch (err) {
          setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong."}` }]);
        } finally {
          setLoading(false);
          setStreaming("");
          setStatus(null);
        }
        return;
      }

      const doFetch = async (retried = false): Promise<Response> => {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: outgoingMessages, accountContext: accountContextRef.current, conversationId: conversationIdRef.current }),
        });
        if (res.status === 401 && !retried) {
          const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshRes.ok) return doFetch(true);
          setSessionExpired(true);
        }
        return res;
      };

      try {
        const res = await doFetch();

        if (!res.ok || res.headers.get("content-type")?.includes("application/json")) {
          const data = await res.json() as { error?: string };
          if (res.status === 401) { setSessionExpired(true); return; }
          throw new Error(data.error ?? "Request failed");
        }

        if (!res.body) throw new Error("No response body");

        let accumulatedText = "";
        // Track indicators by toolId so we can update phase in place
        const indicatorMap = new Map<string, ToolIndicator>();

        const flushIndicators = () => setActiveIndicators([...indicatorMap.values()]);

        for await (const event of readSseStream(res.body)) {
          if (event.type === "token") {
            accumulatedText += event.text;
            setStreaming(accumulatedText);
            // First token = Claude is composing — advance all querying/complete indicators to analyzing
            if (accumulatedText.length > 0 && accumulatedText.length <= event.text.length) {
              for (const ind of indicatorMap.values()) {
                if (ind.phase === "querying" || ind.phase === "complete") {
                  ind.phase = "analyzing";
                  ind.label = "Analyzing…";
                }
              }
              flushIndicators();
            }

          } else if (event.type === "tool_start") {
            const ind: ToolIndicator = {
              toolId:      event.toolId,
              toolName:    event.toolName,
              phase:       "querying",
              recordCount: null,
              label:       QUERYING_LABELS[event.toolName] ?? "Working…",
            };
            indicatorMap.set(event.toolId, ind);
            flushIndicators();

          } else if (event.type === "tool_result") {
            const ind = indicatorMap.get(event.toolId);
            if (ind) {
              ind.phase       = "complete";
              ind.recordCount = event.recordCount;
              ind.label       = event.error ? "Error" : completeLabel(event.toolName, event.recordCount);
              flushIndicators();
            }

          } else if (event.type === "status") {
            setStatus(event.text);

          } else if (event.type === "write_complete") {
            pendingWriteRef.current = { success: event.success, url: event.url };

          } else if (event.type === "done") {
            // Settle all indicators into their final quiet state
            const settled: ToolIndicator[] = [...indicatorMap.values()].map((ind) => ({
              ...ind,
              phase: "settled" as ToolPhase,
              label: settledLabel(ind.toolName, ind.recordCount),
            }));

            const writeResult = pendingWriteRef.current ?? undefined;
            const hasToolCalls = (event.toolCalls?.length ?? 0) > 0;
            const isProposal = detectProposal(accumulatedText, hasToolCalls);
            const { displayText, followUps } = parseFollowUps(accumulatedText);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: displayText,
                toolCalls: hasToolCalls ? event.toolCalls : undefined,
                toolIndicators: settled.length > 0 ? settled : undefined,
                writeResult,
                isProposal: isProposal || undefined,
                followUps: followUps.length > 0 ? followUps : undefined,
                consultedAgentforce: event.consultedAgentforce || undefined,
                summaryAgentUsed: event.summaryAgentUsed || undefined,
                responseBaseMode: mcpMode,
                responsePath: "default",
              },
            ]);
            // Forward render directive to parent (account detail page)
            if (event.render && onRender) {
              onRender(event.render);
            }
            indicatorMap.clear();
            pendingWriteRef.current = null;
            setActiveIndicators([]);
            setStreaming("");
            setStatus(null);

          } else if (event.type === "error") {
            if (event.error === "SF_SESSION_EXPIRED") {
              setSessionExpired(true);
            } else {
              setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${event.error}` }]);
            }
            indicatorMap.clear();
            setActiveIndicators([]);
            setStreaming("");
            setStatus(null);
          }
        }
      } catch (err) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        }]);
        setStreaming("");
        setStatus(null);
      } finally {
        setLoading(false);
      }
    },
    [loading, mcpMode, effectiveResponsePath, sendAgentforce, onRender]
  );

  const handleRecordingChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
    if (recording) {
      interimBaseRef.current = input;
      pendingSubmitRef.current = false;
      setIsInterim(false);
    } else {
      // Mark that we want to auto-submit on the next final transcription result
      pendingSubmitRef.current = true;
      setIsInterim(false);
    }
  }, [input]);

  const handleTranscriptionUpdate = useCallback((text: string, isFinal: boolean) => {
    const base = interimBaseRef.current;
    const separator = base.length > 0 ? " " : "";
    const full = base + separator + text;
    setInput(full);
    setIsInterim(!isFinal);
    if (isFinal) {
      interimBaseRef.current = full;
      if (pendingSubmitRef.current && full.trim()) {
        pendingSubmitRef.current = false;
        // Defer one tick so setInput has flushed before send reads it
        setTimeout(() => send(full.trim()), 0);
      }
    }
  }, [send]);

  // Spacebar hold-to-record shortcut when input is focused and empty
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " && input === "" && !e.repeat) {
      e.preventDefault();
      // Programmatically fire pointer events aren't reliable; dispatch a custom recording start
      // Instead, set a flag and let the MicButton handle it via a forwarded ref approach.
      // We trigger recording by simulating pointerdown on the mic button.
      (document.querySelector("[data-mic-button]") as HTMLElement | null)?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
      );
    }
  }, [input]);

  const handleInputKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " && isRecording) {
      (document.querySelector("[data-mic-button]") as HTMLElement | null)?.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, cancelable: true })
      );
    }
  }, [isRecording]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleSuggestedPrompt(prompt: string) {
    inputRef.current?.focus();
    send(prompt);
  }

  const showSuggestions = messages.length === 0 && !loading;

  const panelWidth = collapsed ? COLLAPSED_WIDTH : `${panelWidthPct * 100}vw`;

  return (
    <div
      className="relative flex h-full shrink-0"
      style={{
        width: panelWidth,
        minWidth: collapsed ? COLLAPSED_WIDTH : "240px",
        maxWidth: collapsed ? undefined : "40vw",
        transition: isResizing ? "none" : "width 200ms ease",
        background: "var(--color-surface)",
        borderLeft: "0.5px solid var(--color-border)",
      }}
    >
      {/* ── Drag handle (left hairline, 4px grab zone) ── */}
      {!collapsed && (
        <div
          className="absolute left-0 inset-y-0 w-1 z-10 cursor-col-resize group"
          onMouseDown={handleDragStart}
        >
          <div
            className="absolute left-0 inset-y-0 w-px transition-colors"
            style={{ background: "var(--color-border)" }}
          />
        </div>
      )}

      {/* ── Collapsed sliver ── */}
      {collapsed && (
        <div
          className="flex flex-col items-center justify-center w-full h-full gap-2 cursor-pointer select-none"
          onClick={handleExpand}
        >
          <SparkleIcon size={13} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "11px",
              color: "var(--color-ink-muted)",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
            }}
          >
            AI Assistant
          </span>
        </div>
      )}

      {/* ── Expanded panel ── */}
      {!collapsed && (
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">

          {/* ── Header ── */}
          <div
            className="px-4 pt-3 pb-3 shrink-0 space-y-2"
            style={{ borderBottom: "0.5px solid var(--color-border)" }}
          >
            {/* Row 1: sparkle + panel title + clear + collapse */}
            <div className="flex items-center gap-2">
              <SparkleIcon size={13} />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-ink)",
                }}
              >
                AI Assistant
              </span>
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    if (mcpMode === "agentforce") {
                      fetch("/api/agent", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "end" }),
                      }).catch(() => {});
                    }
                    setMessages([]);
                    setSessionExpired(false);
                    setShowMcpPrompt(false);
                    conversationIdRef.current = `chat-${Date.now()}`;
                    try { sessionStorage.removeItem(SS_MESSAGES_KEY); } catch {}
                  }}
                  title="Clear conversation"
                  className="transition-opacity hover:opacity-60"
                  style={{ color: "var(--color-ink-soft)", marginLeft: "2px" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleCollapse}
                className="ml-auto transition-opacity hover:opacity-60"
                title="Collapse"
                style={{ color: "var(--color-ink-soft)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Row 2: provider toggle */}
            {providersLoaded && availableProviders.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "var(--color-ink)", marginBottom: 6 }}>
                  No AI providers configured
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", marginBottom: 12 }}>
                  Enable at least one provider to use the AI Assistant.
                </p>
                <a
                  href="/settings#agentforce"
                  style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-accent-text)", textDecoration: "underline" }}
                >
                  Open Settings →
                </a>
              </div>
            ) : (
              <McpModeToggle mode={mcpMode} switching={mcpSwitching} onSwitch={handleModeSwitch} available={availableProviders} />
            )}

            {/* Row 2b: active agent picker (Agentforce only) */}
            {mcpMode === "agentforce" && (
              <AgentPickerRow
                profiles={agentProfiles}
                activeProfile={activeAgentProfile}
                pickerOpen={agentPickerOpen}
                onTogglePicker={() => setAgentPickerOpen((v) => !v)}
                onClosePicker={() => setAgentPickerOpen(false)}
                onSwitch={handleAgentSwitch}
              />
            )}

            {/* Row 2c: response path selector (Local and Hosted only) */}
            <ResponsePathControl
              baseMode={mcpMode}
              path={effectiveResponsePath}
              onChange={setResponsePath}
            />

            {/* Row 3: context pill */}
            <div
              style={{
                borderLeft: "2px solid var(--color-accent)",
                paddingLeft: "8px",
                paddingTop: "3px",
                paddingBottom: "3px",
              }}
            >
              <p
                style={{
                  fontSize: "9px",
                  fontFamily: "var(--font-body)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-soft)",
                  marginBottom: "2px",
                }}
              >
                Context
              </p>
              <p
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--font-display)",
                  color: "var(--color-ink)",
                  fontWeight: 500,
                }}
              >
                {contextString}
              </p>
              <p
                style={{
                  fontSize: "9px",
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  color: "var(--color-ink-soft)",
                  marginTop: "2px",
                }}
              >
                Resets when you leave
              </p>
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">

            {/* Empty state */}
            {showSuggestions && (
              <div className="flex flex-col items-center pt-4 pb-2">
                <div
                  className="w-9 h-9 flex items-center justify-center mb-3"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                    border: "0.5px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
                  }}
                >
                  <SparkleIcon size={16} />
                </div>
                <p
                  className="mb-1 text-center"
                  style={{ fontSize: "13px", fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-ink)" }}
                >
                  What can I help with?
                </p>
                <p
                  className="text-center mb-5"
                  style={{ fontSize: "11px", fontFamily: "var(--font-body)", color: "var(--color-ink-soft)" }}
                >
                  {getNextResponseDescription(mcpMode, effectiveResponsePath).replace("Next response: ", "")}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {suggestedPrompts.map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="text-xs transition-all"
                      style={{
                        padding: "3px 8px",
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        color: "var(--color-ink-muted)",
                        background: "var(--color-surface)",
                        border: "0.5px solid var(--color-border)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--color-ink)";
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent-soft)";
                        (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--color-ink-muted)";
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                        (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Finalized messages */}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                {m.role === "assistant" && m.toolIndicators && m.toolIndicators.length > 0 && mcpMode !== "agentforce" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "4px", maxWidth: "90%" }}>
                    {m.toolIndicators.map((ind) => (
                      <ToolPhaseIndicator key={ind.toolId} indicator={ind} />
                    ))}
                  </div>
                )}
                <div
                  className="max-w-[90%] px-3.5 py-2.5 text-sm"
                  style={
                    m.role === "user"
                      ? { background: "var(--color-ink-deep)", color: "var(--color-paper-bright)" }
                      : m.isProposal
                      ? {
                          background: "color-mix(in srgb, var(--color-warning) 6%, var(--color-surface))",
                          borderLeft: "2px solid var(--color-warning)",
                          color: "var(--color-ink)",
                          border: "0.5px solid color-mix(in srgb, var(--color-warning) 25%, var(--color-border))",
                        }
                      : { background: "var(--color-surface)", border: "0.5px solid var(--color-border)", color: "var(--color-ink)" }
                  }
                >
                  {m.role === "assistant" ? (
                    <>
                      {m.isProposal && (
                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--color-warning)" }}>
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                          Proposed action
                        </div>
                      )}
                      <AssistantMarkdown content={m.content} />
                      {m.writeResult && <WriteResultBanner result={m.writeResult} />}
                      {m.consultedAgentforce && (
                        <div
                          style={{
                            marginTop: "6px",
                            paddingTop: "6px",
                            borderTop: "0.5px solid var(--color-border)",
                            fontFamily: "var(--font-body)",
                            fontSize: "10px",
                            fontStyle: "italic",
                            color: "var(--color-ink-soft)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span style={{ color: "#1E40AF", fontSize: "10px" }}>✦</span>
                          Consulted Agentforce via the Einstein Trust Layer
                        </div>
                      )}
                      {m.summaryAgentUsed && (
                        <div
                          style={{
                            marginTop: "6px",
                            paddingTop: "6px",
                            borderTop: "0.5px solid var(--color-border)",
                            fontFamily: "var(--font-body)",
                            fontSize: "10px",
                            fontStyle: "italic",
                            color: "var(--color-ink-soft)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span style={{ fontSize: "10px" }}>⊕</span>
                          Consulted Account Summary Agent
                        </div>
                      )}
                      {m.responseBaseMode && m.responsePath && (
                        <ResponsePathFooter
                          baseMode={m.responseBaseMode}
                          path={m.responsePath}
                          modelUsed={m.modelUsed}
                          contextPrefetched={m.contextPrefetched}
                          contextSource={m.contextSource}
                        />
                      )}
                    </>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>

                {/* Agentforce choice picker */}
                {m.role === "assistant" && m.choices && m.choices.length > 0 && !m.choiceResolved && (
                  <div className="max-w-[90%]">
                    <AgentforceChoices
                      choices={m.choices}
                      disabled={loading}
                      onSelect={(choice) => handleChoiceSelected(m, choice)}
                    />
                  </div>
                )}

                {/* Agentforce result records and aggregate summaries (read-only) */}
                {m.role === "assistant" && (m.results?.length || m.summaries?.length) ? (
                  <div className="max-w-[90%]">
                    <AgentforceResults results={m.results} summaries={m.summaries} />
                  </div>
                ) : null}

                {/* Follow-up chips */}
                {m.role === "assistant" && m.followUps && m.followUps.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5 max-w-[90%]">
                    {m.followUps.map((fu, j) => (
                      <button
                        key={j}
                        onClick={() => handleSuggestedPrompt(fu)}
                        className="text-left transition-all"
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--font-body)",
                          padding: "3px 8px",
                          color: "var(--color-accent-text)",
                          background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))",
                          border: "0.5px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border))",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))";
                        }}
                      >
                        {fu}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* In-progress tool indicators + streaming bubble */}
            {loading && (
              <div className="flex flex-col items-start gap-1">
                <ActiveToolIndicators indicators={activeIndicators} />
                <InProgressBubble content={streamingContent} status={streamingStatus} />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── MCP connect prompt ── */}
          {showMcpPrompt && <McpConnectPrompt onCancel={() => setShowMcpPrompt(false)} />}

          {/* ── Session expired banner ── */}
          {sessionExpired && <SessionExpiredBanner />}

          {/* ── Input ── */}
          <form
            onSubmit={handleSubmit}
            className="p-3 shrink-0"
            style={{ borderTop: "0.5px solid var(--color-border)" }}
          >
            {/* Mic denied toast */}
            {micDenied && (
              <p style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                color: "var(--color-danger)",
                marginBottom: "6px",
                padding: "3px 6px",
                background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
                border: "0.5px solid color-mix(in srgb, var(--color-danger) 25%, var(--color-border))",
              }}>
                Microphone access denied. Enable in browser settings to use voice input.
              </p>
            )}
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setIsInterim(false); }}
                onKeyDown={handleInputKeyDown}
                onKeyUp={handleInputKeyUp}
                placeholder={isRecording ? "Listening…" : "Ask about your CRM data…"}
                disabled={loading}
                className="flex-1 text-sm px-3 py-2 focus:outline-none disabled:opacity-50"
                style={{
                  background: "var(--color-surface)",
                  border: isRecording
                    ? "1px solid var(--color-accent)"
                    : "0.5px solid var(--color-border)",
                  boxShadow: isRecording
                    ? "0 0 0 2px color-mix(in srgb, var(--color-accent-soft) 30%, transparent)"
                    : "none",
                  color: "var(--color-ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  fontStyle: isInterim ? "italic" : "normal",
                  opacity: isInterim ? 0.75 : 1,
                  transition: "border 120ms ease, box-shadow 120ms ease",
                }}
                onFocus={(e) => {
                  if (!isRecording) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent-soft)";
                }}
                onBlur={(e) => {
                  if (!isRecording) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                }}
              />
              <MicButton
                data-mic-button=""
                onTranscriptionUpdate={handleTranscriptionUpdate}
                onRecordingChange={(rec) => {
                  handleRecordingChange(rec);
                  // If recording just stopped and nothing was transcribed, reset input to pre-recording state
                  if (!rec && isInterim) {
                    setInput(interimBaseRef.current);
                    setIsInterim(false);
                  }
                }}
                onDenied={() => setMicDenied(true)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex items-center justify-center w-9 h-9 shrink-0 transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </form>

          {/* ── Footer ── */}
          <div className="px-4 pb-2.5 shrink-0">
            <p
              className="text-center"
              style={{ fontSize: "9px", fontFamily: "var(--font-body)", color: "var(--color-ink-soft)" }}
            >
              Powered by <span style={{ fontWeight: 500, color: "var(--color-ink-muted)" }}>Claude</span> · Anthropic
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
