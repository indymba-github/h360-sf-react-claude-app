"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
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

function fmtAxis(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function fmtFull(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const { value, payload: inner } = payload[0];
  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", padding: "8px 12px", fontFamily: "var(--font-body)", fontSize: "11px" }}>
      <p style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "var(--color-ink)" }}>{fmtFull(value)}</p>
      <p style={{ color: "var(--color-ink-soft)" }}>{inner.count} opportunit{inner.count !== 1 ? "ies" : "y"}</p>
    </div>
  );
}

const BAR_OPACITIES = [0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 1.0];

export default function PipelineChart({ stages }: { stages: SFPipelineStage[] }) {
  const accent = useToken("--color-accent", "#946F1F");

  const data = stages.map((s) => ({
    name: s.StageName,
    amount: s.totalAmt ?? 0,
    count: s.cnt,
  }));

  if (data.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>
        No open pipeline data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "var(--color-ink-muted)" as string }}
          tickLine={{ stroke: "var(--color-border)" as string }}
          axisLine={false}
          interval={0}
          angle={data.length > 4 ? -25 : 0}
          textAnchor={data.length > 4 ? "end" : "middle"}
          height={data.length > 4 ? 48 : 24}
        />
        <YAxis
          tickFormatter={fmtAxis}
          tick={{ fontSize: 10, fill: "var(--color-ink-muted)" as string }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "color-mix(in srgb, var(--color-ink) 5%, transparent)" }} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={accent}
              fillOpacity={BAR_OPACITIES[Math.min(i, BAR_OPACITIES.length - 1)]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
