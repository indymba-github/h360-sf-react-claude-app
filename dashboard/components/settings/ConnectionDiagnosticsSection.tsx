"use client";

import { useEffect, useState } from "react";
import type { ConnectionHealth, ConnectionHealthCheck, ConnectionHealthStatus } from "@/lib/connection-health";

const STATUS_LABELS: Record<ConnectionHealthStatus, string> = {
  ready: "Ready",
  needs_setup: "Needs setup",
  inactive: "Inactive",
};

const STATUS_COLORS: Record<ConnectionHealthStatus, string> = {
  ready: "var(--color-accent)",
  needs_setup: "var(--color-danger)",
  inactive: "var(--color-ink-soft)",
};

function StatusDot({ status }: { status: ConnectionHealthStatus }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: STATUS_COLORS[status],
        opacity: status === "inactive" ? 0.45 : 1,
        flexShrink: 0,
        marginTop: 4,
      }}
    />
  );
}

function HealthRow({ check, showDivider }: { check: ConnectionHealthCheck; showDivider: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderBottom: showDivider ? "0.5px solid var(--color-border)" : "none",
        background: "var(--color-paper)",
      }}
    >
      <StatusDot status={check.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
            {check.label}
          </span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: check.status === "ready" ? "var(--color-ink-muted)" : "var(--color-ink-soft)" }}>
            {STATUS_LABELS[check.status]}
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", lineHeight: 1.45 }}>
          {check.detail}
        </p>
        {check.credentialSource && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-muted)", lineHeight: 1.4, marginTop: 4 }}>
            Credential source: <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>{check.credentialSource}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ConnectionDiagnosticsSection() {
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostics/health");
      const data = await res.json() as ConnectionHealth & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Diagnostics failed");
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <div className="p-5 space-y-5" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
      <div className="flex items-start justify-between gap-4">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", lineHeight: 1.5 }}>
          Check whether the configured AI paths have the session and credentials they need.
        </p>
        <button
          onClick={() => void loadHealth()}
          disabled={loading}
          className="shrink-0 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: "var(--color-paper)", color: "var(--color-ink-muted)", border: "0.5px solid var(--color-border)", fontFamily: "var(--font-body)", fontSize: "11px" }}
        >
          {loading ? "Checking" : "Refresh"}
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)" }}>{error}</p>
      )}

      {!health && !error && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
          Loading diagnostics...
        </p>
      )}

      {health && (
        <div style={{ border: "0.5px solid var(--color-border)" }}>
          {health.checks.map((check, index) => (
            <HealthRow
              key={check.id}
              check={check}
              showDivider={index < health.checks.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
