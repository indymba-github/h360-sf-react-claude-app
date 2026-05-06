"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  writeResult?: WriteResult;   // set when the message came from a write operation
  isProposal?: boolean;        // set when Claude is asking for write confirmation
}

// SSE event shapes coming from the server
interface SseToken        { type: "token";         text: string }
interface SseStatus       { type: "status";        text: string }
interface SseDone         { type: "done";           toolCalls: ToolCall[] }
interface SseError        { type: "error";          error: string }
interface SseWriteComplete { type: "write_complete"; toolName: string; success: boolean; url: string | null }
type SseEvent = SseToken | SseStatus | SseDone | SseError | SseWriteComplete;

// Heuristic: does this text look like Claude asking for write confirmation?
const WRITE_VERB_RE   = /\b(create|add|log|update|modify|change|schedule|record)\b/i;
const CONFIRM_PHRASE_RE = /\b(shall I|should I|would you like|want me to|confirm|go ahead|proceed|ready to)\b/i;

function detectProposal(text: string, hasToolCalls: boolean): boolean {
  if (hasToolCalls) return false; // proposals never call tools
  return WRITE_VERB_RE.test(text) && CONFIRM_PHRASE_RE.test(text);
}

// ── Suggested prompts ──────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { label: "Pipeline summary",   prompt: "Give me a summary of the current sales pipeline." },
  { label: "High-risk accounts", prompt: "Which accounts look high-risk or need immediate attention?" },
  { label: "Search for a company", prompt: "Search for accounts related to technology." },
  { label: "Recent activity",    prompt: "What are the most recently modified records in the CRM?" },
];

// ── Tool icon ──────────────────────────────────────────────────────────────

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
          <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-600 italic my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-gray-200 my-3" />,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className="block bg-gray-800 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2 whitespace-pre">
              {children}
            </code>
          ) : (
            <code className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-xs font-mono">
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
          <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-200 px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Tool call badges (on finalized messages) ───────────────────────────────

function ToolCallsUsed({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? toolCalls : toolCalls.slice(0, 3);
  const hasMore = toolCalls.length > 3;

  return (
    <div className="flex flex-wrap items-center gap-1 mb-1.5 max-w-[90%]">
      {visible.map((tc, j) => (
        <span
          key={j}
          className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5"
        >
          <span style={{ color: "var(--color-secondary)" }}><ToolIcon name={tc.name} /></span>
          {tc.label}
        </span>
      ))}
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
        >
          +{toolCalls.length - 3} more
        </button>
      )}
    </div>
  );
}

// ── Write result banner ────────────────────────────────────────────────────

function WriteResultBanner({ result }: { result: WriteResult }) {
  if (result.success) {
    return (
      <div
        className="mt-2 flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border"
        style={{
          color: "var(--color-secondary)",
          background: "color-mix(in srgb, var(--color-secondary) 10%, white)",
          borderColor: "color-mix(in srgb, var(--color-secondary) 25%, white)",
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
            style={{ color: "var(--color-secondary)" }}
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
    <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
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
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
    </div>
  );
}

// ── In-progress bubble (dots → streaming text + optional status line) ──────

function InProgressBubble({
  content,
  status,
}: {
  content: string;
  status: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      {status && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
          {status}
        </div>
      )}
      <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm max-w-[90%]">
        {content ? (
          // Render as plain text while streaming to avoid markdown re-parse flicker
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
    <div className="mx-4 mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
      <p className="font-medium mb-1">Salesforce session expired</p>
      <a href="/api/auth/login" className="underline hover:text-amber-900">
        Re-connect to Salesforce →
      </a>
    </div>
  );
}

// ── MCP not-connected banner ───────────────────────────────────────────────

function McpConnectPrompt({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mx-4 mb-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-3 text-xs text-blue-800">
      <p className="font-medium mb-1">Salesforce MCP not connected</p>
      <p className="text-blue-600 mb-2">
        You need to authorise the Hosted MCP app before using it.
      </p>
      <div className="flex items-center gap-2">
        <a
          href="/api/auth/mcp-login"
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-white font-medium hover:bg-blue-500 transition-colors"
        >
          Connect MCP →
        </a>
        <button
          onClick={onCancel}
          className="text-blue-500 hover:text-blue-700 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── MCP mode toggle (pill) ─────────────────────────────────────────────────

type McpMode = "local" | "hosted" | "agentforce";

const MODE_LABELS: Record<McpMode, string> = {
  local: "Custom MCP server (stdio)",
  hosted: "Salesforce Hosted MCP",
  agentforce: "Salesforce Agentforce Agent",
};

function McpModeToggle({
  mode,
  switching,
  onSwitch,
}: {
  mode: McpMode;
  switching: boolean;
  onSwitch: (m: McpMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-medium select-none">
      {(["local", "hosted", "agentforce"] as McpMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onSwitch(m)}
          disabled={switching}
          className={`rounded-full px-2.5 py-0.5 transition-colors capitalize ${
            mode === m
              ? m === "agentforce"
                ? "bg-[#0176D3] text-white shadow-sm"
                : "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {m === "agentforce" ? "Agentforce" : m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
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

      // SSE events are separated by blank lines (\n\n)
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

// ── sessionStorage keys ────────────────────────────────────────────────────

const STORAGE_MESSAGES_KEY  = "sf-chat-messages";
const STORAGE_MODE_KEY      = "sf-chat-mcp-mode";
const STORAGE_WIDTH_KEY     = "sf-chat-width";
const STORAGE_COLLAPSED_KEY = "sf-chat-collapsed";
const STORAGE_CONTEXT_KEY   = "sf-chat-account-context";

const MIN_WIDTH      = 320;
const MAX_WIDTH      = 700;
const DEFAULT_WIDTH  = 380;
const COLLAPSED_WIDTH = 40;

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatPanel({
  accountContext: accountContextProp,
  initialMcpMode = "local",
  hasMcpToken = false,
}: {
  accountContext?: AccountContext;
  initialMcpMode?: McpMode;
  hasMcpToken?: boolean;
}) {
  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [streamingContent, setStreaming]    = useState("");
  const [streamingStatus, setStatus]        = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [mcpMode, setMcpMode]               = useState<McpMode>(initialMcpMode);
  const [mcpSwitching, setMcpSwitching]     = useState(false);
  const [showMcpPrompt, setShowMcpPrompt]   = useState(false);
  const [panelWidth, setPanelWidth]         = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed]           = useState(false);
  const [isResizing, setIsResizing]         = useState(false);
  const [accountContext, setAccountContext] = useState<AccountContext | undefined>(accountContextProp);
  // Accumulates write_complete events for the current response turn
  const pendingWriteRef  = useRef<WriteResult | null>(null);
  const isDragging       = useRef(false);
  const dragStartX       = useRef(0);
  const dragStartWidth   = useRef(DEFAULT_WIDTH);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamingContent]);

  // Load persisted state after hydration (never during SSR)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_MESSAGES_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_MODE_KEY);
      if (saved === "local" || saved === "hosted" || saved === "agentforce") setMcpMode(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_WIDTH_KEY);
      if (saved) {
        const w = parseInt(saved, 10);
        if (!isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) setPanelWidth(w);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_COLLAPSED_KEY);
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  // Load account context from sessionStorage (fallback when prop not provided)
  useEffect(() => {
    if (accountContextProp) {
      setAccountContext(accountContextProp);
      try { sessionStorage.setItem(STORAGE_CONTEXT_KEY, JSON.stringify(accountContextProp)); } catch {}
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_CONTEXT_KEY);
      if (saved) setAccountContext(JSON.parse(saved) as AccountContext);
    } catch {}
  }, [accountContextProp]);

  // Persist on every change
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      try {
        sessionStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_MODE_KEY, mcpMode);
      } catch {}
    }
  }, [mcpMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_WIDTH_KEY, String(panelWidth));
      } catch {}
    }
  }, [panelWidth]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_COLLAPSED_KEY, String(collapsed));
      } catch {}
    }
  }, [collapsed]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    setIsResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [collapsed, panelWidth]);

  const handleModeSwitch = useCallback(async (newMode: McpMode) => {
    if (newMode === mcpMode || mcpSwitching) return;

    if (newMode === "hosted" && !hasMcpToken) {
      setShowMcpPrompt(true);
      return;
    }

    setMcpSwitching(true);
    try {
      // If leaving Agentforce, end the server-side agent session
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
        setMessages([]);
        setSessionExpired(false);
        setShowMcpPrompt(false);
      }
    } finally {
      setMcpSwitching(false);
    }
  }, [mcpMode, mcpSwitching, hasMcpToken]);

  const sendAgentforce = useCallback(async (trimmed: string) => {
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", text: trimmed, accountContext }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Agentforce request failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "" },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        },
      ]);
    } finally {
      setStreaming("");
      setStatus(null);
      setLoading(false);
    }
  }, []);

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
      setStatus(mcpMode === "agentforce" ? "Agentforce is working…" : null);
      pendingWriteRef.current = null;

      // ── Agentforce path ────────────────────────────────────────────
      if (mcpMode === "agentforce") {
        await sendAgentforce(trimmed);
        return;
      }

      // ── MCP / Claude path ──────────────────────────────────────────
      const outgoingMessages = [...messages, userMsg];

      // Attempt fetch, with a single token-refresh retry on 401
      const doFetch = async (retried = false): Promise<Response> => {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: outgoingMessages, accountContext }),
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

        // ── Non-streaming error responses (400, 401, 500) ──────────────
        if (!res.ok || res.headers.get("content-type")?.includes("application/json")) {
          const data = await res.json() as { error?: string };
          if (res.status === 401) { setSessionExpired(true); return; }
          throw new Error(data.error ?? "Request failed");
        }

        // ── Streaming path ─────────────────────────────────────────────
        if (!res.body) throw new Error("No response body");

        let accumulatedText = "";

        for await (const event of readSseStream(res.body)) {
          if (event.type === "token") {
            accumulatedText += event.text;
            setStreaming(accumulatedText);

          } else if (event.type === "status") {
            setStatus(event.text);

          } else if (event.type === "write_complete") {
            // Last write result wins (most responses have at most one write per turn)
            pendingWriteRef.current = { success: event.success, url: event.url };

          } else if (event.type === "done") {
            const writeResult = pendingWriteRef.current ?? undefined;
            const hasToolCalls = (event.toolCalls?.length ?? 0) > 0;
            const isProposal = detectProposal(accumulatedText, hasToolCalls);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: accumulatedText,
                toolCalls: hasToolCalls ? event.toolCalls : undefined,
                writeResult,
                isProposal: isProposal || undefined,
              },
            ]);
            pendingWriteRef.current = null;
            setStreaming("");
            setStatus(null);

          } else if (event.type === "error") {
            if (event.error === "SF_SESSION_EXPIRED") {
              setSessionExpired(true);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `**Error:** ${event.error}`,
                },
              ]);
            }
            setStreaming("");
            setStatus(null);
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
          },
        ]);
        setStreaming("");
        setStatus(null);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, accountContext, mcpMode, sendAgentforce]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleSuggestedPrompt(prompt: string) {
    inputRef.current?.focus();
    send(prompt);
  }

  const showSuggestions = messages.length === 0 && !loading;

  return (
    <div
      className="relative flex flex-row h-full border-l border-gray-200 bg-white shrink-0"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : panelWidth,
        minWidth: collapsed ? COLLAPSED_WIDTH : MIN_WIDTH,
        transition: isResizing ? "none" : "width 200ms ease",
      }}
    >
      {/* ── Drag handle + collapse toggle ── */}
      <div
        className={`relative w-3 shrink-0 flex items-start justify-center group${!collapsed ? " cursor-col-resize" : ""}`}
        onMouseDown={handleDragStart}
      >
        {!collapsed && (
          <div className="absolute left-0 inset-y-0 w-0.5 bg-gray-200 group-hover:bg-blue-400 transition-colors" />
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          onMouseDown={(e) => e.stopPropagation()}
          title={collapsed ? "Expand chat" : "Collapse chat"}
          className="mt-16 relative z-10 flex items-center justify-center w-5 h-7 rounded border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-blue-300 shadow-sm transition-colors shrink-0"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            )}
          </svg>
        </button>
      </div>

      {/* ── Collapsed label ── */}
      {collapsed && (
        <div
          className="flex-1 flex flex-col items-center justify-center cursor-pointer select-none"
          onClick={() => setCollapsed(false)}
        >
          <span
            className="text-xs font-semibold text-gray-400"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            AI Chat
          </span>
        </div>
      )}

      {/* ── Expanded panel content ── */}
      {!collapsed && (
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          {/* ── Header ── */}
          <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 shrink-0 space-y-2">
            {/* Row 1: title + Claude label + clear button */}
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-secondary)" }} />
              <span className="text-sm font-semibold text-gray-900">AI Assistant</span>
              <span className="text-xs text-gray-400 ml-auto mr-2">Claude</span>
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
                    try { sessionStorage.removeItem(STORAGE_MESSAGES_KEY); } catch {}
                  }}
                  title="Clear chat"
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              )}
            </div>
            {/* Row 2: mode toggle + subtitle */}
            <div className="flex items-center justify-between">
              <McpModeToggle mode={mcpMode} switching={mcpSwitching} onSwitch={handleModeSwitch} />
              <span className={`text-[10px] italic ${mcpMode === "agentforce" ? "text-[#0176D3]" : "text-gray-400"}`}>
                {MODE_LABELS[mcpMode]}
              </span>
            </div>
            {/* Row 3: account context pill */}
            {accountContext && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border"
                  style={{
                    color: "var(--color-secondary)",
                    background: "color-mix(in srgb, var(--color-secondary) 10%, white)",
                    borderColor: "color-mix(in srgb, var(--color-secondary) 25%, white)",
                  }}
                >
                  <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                  </svg>
                  Viewing: {accountContext.accountName}
                </span>
              </div>
            )}
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {/* Empty state */}
            {showSuggestions && (
              <div className="flex flex-col items-center pt-4 pb-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">Ask about your CRM</p>
                <p className="text-xs text-gray-400 text-center mb-5">
                  I can look up accounts, opportunities,<br />cases, contacts, and pipeline data.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 transition-colors"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
                        (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--color-secondary) 40%, white)";
                        (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-secondary) 8%, white)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "";
                        (e.currentTarget as HTMLElement).style.borderColor = "";
                        (e.currentTarget as HTMLElement).style.background = "";
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
                {m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0 && mcpMode !== "agentforce" && (
                  <ToolCallsUsed toolCalls={m.toolCalls} />
                )}
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : m.isProposal
                      ? "bg-amber-50 text-gray-800 rounded-bl-sm border-l-2 border-amber-400"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <>
                      {m.isProposal && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-1.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                          Proposed action
                        </div>
                      )}
                      <AssistantMarkdown content={m.content} />
                      {m.writeResult && <WriteResultBanner result={m.writeResult} />}
                    </>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* In-progress bubble — dots until tokens arrive, then streaming text */}
            {loading && (
              <InProgressBubble content={streamingContent} status={streamingStatus} />
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── MCP connect prompt ── */}
          {showMcpPrompt && <McpConnectPrompt onCancel={() => setShowMcpPrompt(false)} />}

          {/* ── Session expired banner ── */}
          {sessionExpired && <SessionExpiredBanner />}

          {/* ── Input ── */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your CRM data…"
                disabled={loading}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </form>

          {/* ── Footer ── */}
          <div className="px-4 pb-3 shrink-0">
            <p className="text-center text-[10px] text-gray-300">
              Powered by <span className="font-medium text-gray-400">Claude</span> · Anthropic
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
