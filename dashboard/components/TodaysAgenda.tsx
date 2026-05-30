"use client";

import { useAiContext } from "@/lib/use-ai-context";

export interface AgendaTask {
  id: string;
  type: "task";
  subject: string;
  whoName: string | null;
  whatName: string | null;
  whatId: string | null;
  priority: string | null;
}

export interface AgendaEvent {
  id: string;
  type: "event";
  subject: string;
  startTime: string | null;   // ISO or null (all-day)
  endTime: string | null;
  isAllDay: boolean;
  whoName: string | null;
  whatName: string | null;
  whatId: string | null;
}

export type AgendaItem = AgendaTask | AgendaEvent;


function formatTimeRange(start: string | null, end: string | null, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  if (!start) return "Today";
  const s = new Date(start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!end) return s;
  const e = new Date(end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${s} – ${e}`;
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const { sendPrompt } = useAiContext();

  const timeLabel =
    item.type === "event"
      ? formatTimeRange(item.startTime, item.endTime, item.isAllDay)
      : "Today";

  const relatedName = item.whatName ?? item.whoName ?? null;
  const relatedHref = item.whatId ? `/accounts/${item.whatId}` : null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-3"
      style={{ borderBottom: "0.5px solid var(--color-border)" }}
    >
      {/* Time */}
      <div style={{ width: 90, flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
        {timeLabel}
      </div>

      {/* Subject */}
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }} className="truncate">
          {item.subject}
        </p>
      </div>

      {/* Related */}
      {relatedName && (
        <div style={{ flexShrink: 0, maxWidth: 160 }}>
          {relatedHref ? (
            <a
              href={relatedHref}
              style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-accent-text)", textDecoration: "none" }}
              className="truncate block hover:underline"
            >
              {relatedName}
            </a>
          ) : (
            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }} className="truncate block">
              {relatedName}
            </span>
          )}
        </div>
      )}

      {/* Prep me */}
      <button
        onClick={() => sendPrompt(`Prep me for ${item.subject}${relatedName ? ` with ${relatedName}` : ""}`)}
        style={{
          flexShrink: 0,
          fontFamily: "var(--font-body)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          padding: "3px 10px",
          border: "0.5px solid var(--color-accent-text)",
          color: "var(--color-accent-text)",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        Prep me
      </button>
    </div>
  );
}

export default function TodaysAgenda({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="px-5 py-4"
        style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>
          Nothing scheduled for today.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
      {items.map((item) => (
        <AgendaRow key={item.id} item={item} />
      ))}
    </div>
  );
}
