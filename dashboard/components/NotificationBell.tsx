"use client";

import { useState, useEffect, useRef } from "react";
import type { SFNotification } from "@/hooks/useNotificationPoller";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

interface Props {
  alerts: SFNotification[];
  unreadCount: number;
  onMarkSeen: () => void;
  onDismiss: (id: string) => void;
}

const DROPDOWN_WIDTH = 360;

export default function NotificationBell({ alerts, unreadCount, onMarkSeen, onDismiss }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleToggle() {
    if (!open) {
      onMarkSeen();
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const top = rect.bottom + 6;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8));
        setPos({ top, left });
      }
    }
    setOpen(o => !o);
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{ position: "relative", padding: 6, background: "none", border: "none", cursor: "pointer", borderRadius: 4, color: "color-mix(in srgb, var(--color-paper) 75%, transparent)" }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`}
        aria-expanded={open}
      >
        <span
          key={unreadCount > 0 ? unreadCount : "still"}
          style={unreadCount > 0 ? { display: "inline-block", animation: "bounce 0.5s 3" } : { display: "inline-block" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: "var(--color-danger)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px", fontFamily: "var(--font-body)" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{ position: "fixed", zIndex: 200, top: pos.top, left: pos.left, width: DROPDOWN_WIDTH, background: "var(--color-surface)", border: "0.5px solid var(--color-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>Notifications</span>
            {alerts.length > 0 && (
              <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)" }}>{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div style={{ overflowY: "auto", maxHeight: 340 }}>
            {alerts.length === 0 ? (
              <p style={{ padding: "24px 16px", textAlign: "center", fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>No alerts</p>
            ) : (
              alerts.map(a => {
                const isHigh = a.priority === "High";
                const href = a.accountId ? `/accounts/${a.accountId}` : "/dashboard";
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", borderBottom: "0.5px solid var(--color-border)" }}>
                    <a
                      href={href}
                      onClick={() => setOpen(false)}
                      style={{ flex: 1, minWidth: 0, padding: "10px 16px", display: "block", textDecoration: "none" }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <p style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.subject}</p>
                        <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)" }}>{relativeTime(a.createdDate)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        {a.accountName && (
                          <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.accountName}</span>
                        )}
                        {a.priority && (
                          <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "9px", padding: "1px 5px", background: isHigh ? "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))" : "color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))", color: isHigh ? "var(--color-danger)" : "var(--color-warning)" }}>
                            {a.priority}
                          </span>
                        )}
                      </div>
                    </a>
                    <button
                      onClick={() => onDismiss(a.id)}
                      style={{ flexShrink: 0, padding: 6, color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer" }}
                      aria-label="Dismiss"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border)" }}>
            <a href="/dashboard" onClick={() => setOpen(false)} style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-accent-text)", textDecoration: "none" }}>
              View all on dashboard →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
