"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { SFPipelineStage } from "@/lib/salesforce";

// Resolves a CSS variable after mount and re-resolves on theme-changed / branding-reset events.
function useToken(varName: string, fallback: string): string {
  const resolve = () =>
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;

  const [value, setValue] = useState(fallback);

  useEffect(() => {
    setValue(resolve());
    const refresh = () => setValue(resolve());
    window.addEventListener("theme-changed", refresh);
    window.addEventListener("branding-reset", refresh);
    return () => {
      window.removeEventListener("theme-changed", refresh);
      window.removeEventListener("branding-reset", refresh);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function fmtFull(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

type PipelinePayloadEntry = {
  value: number;
  payload: {
    name: string;
    count: number;
    percent: number;
  };
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: PipelinePayloadEntry[] }) {
  if (!active || !payload?.length) return null;
  const { value, payload: inner } = payload[0];
  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", padding: "8px 12px", fontFamily: "var(--font-body)", fontSize: "11px" }}>
      <p style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>{inner.name}</p>
      <p style={{ color: "var(--color-ink)" }}>{fmtFull(value)}</p>
      <p style={{ color: "var(--color-ink-soft)" }}>{inner.percent}% · {inner.count} opportunit{inner.count !== 1 ? "ies" : "y"}</p>
    </div>
  );
}

export default function PipelineChart({ stages }: { stages: SFPipelineStage[] }) {
  const accent = useToken("--color-accent", "#946F1F");
  const success = useToken("--color-success", "#26734D");
  const warning = useToken("--color-warning", "#A0671A");
  const stall = useToken("--color-stall", "#8F4D24");
  const muted = useToken("--color-ink-muted", "#6B7280");
  const soft = useToken("--color-ink-soft", "#8B929E");
  const palette = [accent, success, warning, stall, muted, soft];

  const totalAmount = stages.reduce((sum, stage) => sum + (stage.totalAmt ?? 0), 0);
  const data = stages
    .map((s) => {
      const amount = s.totalAmt ?? 0;
      return {
        name: s.StageName,
        amount,
        count: s.cnt,
        percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.name.localeCompare(b.name));

  if (data.length === 0 || totalAmount <= 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>
        No open pipeline data
      </div>
    );
  }

  return (
    <div style={{ height: 170, maxWidth: 280, margin: "0 auto", minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius="64%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="var(--color-surface)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-display)", fontSize: 21, fill: "var(--color-ink)" }}>
            {fmtShort(totalAmount)}
          </text>
          <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-body)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fill: "var(--color-ink-soft)" }}>
            Open pipeline
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
