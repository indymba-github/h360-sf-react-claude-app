"use client";

import type { SFTask } from "@/lib/salesforce";
import { useRouter } from "next/navigation";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function NewspaperIcon({ color }: { color: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

interface Props {
  alert: SFTask;
  onDismiss?: (id: string) => void;
}

export default function NewsAlertCard({ alert, onDismiss }: Props) {
  const router = useRouter();
  const subject = alert.Subject?.replace(/^News Alert:\s*/i, "") ?? "(no subject)";
  const isHigh = alert.Priority === "High";

  const borderColor = isHigh ? "var(--color-danger)" : "var(--color-accent-soft)";
  const iconColor = isHigh ? "var(--color-danger)" : "var(--color-accent-soft)";
  const priorityBg = isHigh
    ? "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))"
    : "color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))";
  const priorityColor = isHigh ? "var(--color-danger)" : "var(--color-warning)";

  function handleClick() {
    if (alert.WhatId) router.push(`/accounts/${alert.WhatId}`);
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "0.5px solid var(--color-border)",
        borderLeft: `3px solid ${borderColor}`,
        cursor: alert.WhatId ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px" }}>
        <NewspaperIcon color={iconColor} />

        <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subject}
        </span>

        {alert.What?.Name && (
          <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {alert.What.Name}
          </span>
        )}

        <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)", letterSpacing: "0.04em" }}>
          {relativeTime(alert.CreatedDate)}
        </span>

        {alert.Priority && (
          <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.08em", padding: "2px 6px", background: priorityBg, color: priorityColor }}>
            {alert.Priority}
          </span>
        )}

        {onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(alert.Id); }}
            style={{ flexShrink: 0, padding: 2, color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer" }}
            aria-label="Dismiss alert"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
