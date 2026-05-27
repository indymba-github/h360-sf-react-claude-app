"use client";

import { useState, useCallback } from "react";
import type { SFTask } from "@/lib/salesforce";
import NewsAlertCard from "./NewsAlertCard";

async function dismissAlert(taskId: string): Promise<void> {
  const res = await fetch("/api/salesforce/dismiss-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to dismiss alert");
  }
}

interface Props {
  initialAlerts: SFTask[];
  variant?: "dashboard" | "account";
}

const PAGE_SIZE = 3;

function DashboardAlerts({ alerts, onDismiss, onClearAll }: {
  alerts: SFTask[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}) {
  const [page, setPage] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const totalPages = Math.ceil(alerts.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const start = safePage * PAGE_SIZE;
  const visible = alerts.slice(start, start + PAGE_SIZE);

  function prev() { setPage(p => Math.max(0, p - 1)); }
  function next() { setPage(p => Math.min(totalPages - 1, p + 1)); }

  const chevronStyle = (disabled: boolean): React.CSSProperties => ({
    padding: 4,
    background: "none",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    color: disabled ? "var(--color-border)" : "var(--color-ink-soft)",
  });

  return (
    <>
      {/* Section controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
          News Alerts
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.08em", padding: "2px 7px", background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))", color: "var(--color-accent-text)" }}>
          {alerts.length} New
        </span>
        {alerts.length > PAGE_SIZE && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)" }}>
            {start + 1}–{Math.min(start + PAGE_SIZE, alerts.length)} of {alerts.length}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {alerts.length > PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button onClick={prev} disabled={safePage === 0} style={chevronStyle(safePage === 0)} aria-label="Previous">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={next} disabled={safePage >= totalPages - 1} style={chevronStyle(safePage >= totalPages - 1)} aria-label="Next">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          )}

          {confirming ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)" }}>Clear all?</span>
              <button onClick={() => { onClearAll(); setConfirming(false); }} style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer" }}>Yes</button>
              <button onClick={() => setConfirming(false)} style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer" }}>
              Clear all
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {visible.map(a => (
          <NewsAlertCard key={a.Id} alert={a} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

function AccountAlerts({ alerts, onDismiss }: { alerts: SFTask[]; onDismiss: (id: string) => void }) {
  const [showMore, setShowMore] = useState(false);
  const visible = showMore ? alerts : alerts.slice(0, 3);
  const hidden = alerts.length - 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {visible.map(a => (
        <NewsAlertCard key={a.Id} alert={a} onDismiss={onDismiss} />
      ))}
      {!showMore && hidden > 0 && (
        <button
          onClick={() => setShowMore(true)}
          style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-accent-text)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}
        >
          Show {hidden} more alert{hidden !== 1 ? "s" : ""} ▸
        </button>
      )}
      {showMore && (
        <button
          onClick={() => setShowMore(false)}
          style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}
        >
          Show less
        </button>
      )}
    </div>
  );
}

export default function NewsAlertsSection({ initialAlerts, variant = "dashboard" }: Props) {
  const [alerts, setAlerts] = useState<SFTask[]>(initialAlerts);

  if (alerts.length === 0) return null;

  async function handleDismiss(id: string) {
    const removed = alerts.find(a => a.Id === id);
    setAlerts(prev => prev.filter(a => a.Id !== id));
    try {
      await dismissAlert(id);
    } catch {
      if (removed) setAlerts(prev => [removed, ...prev].sort((a, b) => b.CreatedDate.localeCompare(a.CreatedDate)));
    }
  }

  async function handleClearAll() {
    const snapshot = [...alerts];
    setAlerts([]);
    const results = await Promise.allSettled(snapshot.map(a => dismissAlert(a.Id)));
    const failed = snapshot.filter((_, i) => results[i].status === "rejected");
    if (failed.length > 0) {
      setAlerts(prev => [...failed, ...prev].sort((a, b) => b.CreatedDate.localeCompare(a.CreatedDate)));
    }
  }

  return variant === "dashboard"
    ? <DashboardAlerts alerts={alerts} onDismiss={handleDismiss} onClearAll={handleClearAll} />
    : <AccountAlerts alerts={alerts} onDismiss={handleDismiss} />;
}
