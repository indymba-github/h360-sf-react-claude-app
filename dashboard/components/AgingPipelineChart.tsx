"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useRouter } from "next/navigation";
import SalesforceLink from "./SalesforceLink";

export interface AgingOpportunity {
  id: string;
  accountId: string | null;
  name: string;
  stageName: string;
  amount: number | null;
  daysStalled: number;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function fmtFull(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

// Resolves a pair of CSS color tokens and interpolates between them based on ratio.
function useStallColors(): (ratio: number) => string {
  const resolve = (v: string, fb: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

  const [soft, setSoft] = useState("#E8847A");
  const [hard, setHard] = useState("#C84A3F");

  useEffect(() => {
    const refresh = () => {
      setSoft(resolve("--color-stall-soft", "#E8847A"));
      setHard(resolve("--color-stall", "#C84A3F"));
    };
    refresh();
    window.addEventListener("theme-changed", refresh);
    window.addEventListener("branding-reset", refresh);
    return () => {
      window.removeEventListener("theme-changed", refresh);
      window.removeEventListener("branding-reset", refresh);
    };
  }, []);

  return (ratio: number) => {
    const parse = (hex: string) => {
      const h = hex.replace("#", "");
      return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)] as const;
    };
    const s = parse(soft.startsWith("#") ? soft : "#E8847A");
    const h = parse(hard.startsWith("#") ? hard : "#C84A3F");
    const r = Math.round(s[0] + (h[0] - s[0]) * ratio);
    const g = Math.round(s[1] + (h[1] - s[1]) * ratio);
    const b = Math.round(s[2] + (h[2] - s[2]) * ratio);
    return `rgb(${r},${g},${b})`;
  };
}

function CustomTooltip({ active, payload, instanceUrl }: { active?: boolean; payload?: any[]; instanceUrl?: string }) {
  if (!active || !payload?.length) return null;
  const d: AgingOpportunity = payload[0].payload;
  return (
    <div style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", padding: "8px 12px", fontFamily: "var(--font-body)", fontSize: "11px", maxWidth: 240 }}>
      <p style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>{d.name}</p>
      <p style={{ color: "var(--color-ink-soft)" }}>{d.stageName}</p>
      <p style={{ color: "var(--color-ink)" }}>{d.daysStalled} days in stage</p>
      <p style={{ color: "var(--color-ink-soft)", marginTop: 2 }}>{fmtFull(d.amount)}</p>
      {instanceUrl && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "0.5px solid var(--color-border)" }}>
          <SalesforceLink instanceUrl={instanceUrl} recordId={d.id} variant="text" label="View opportunity" />
        </div>
      )}
    </div>
  );
}

export default function AgingPipelineChart({ opportunities, instanceUrl }: { opportunities: AgingOpportunity[]; instanceUrl?: string }) {
  const router = useRouter();
  const stallColor = useStallColors();
  const maxDays = opportunities.reduce((m, o) => Math.max(m, o.daysStalled), 0);

  if (opportunities.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>
        No stalled pipeline
      </div>
    );
  }

  const data = [...opportunities].sort((a, b) => b.daysStalled - a.daysStalled);
  const barHeight = 28;
  const chartHeight = Math.max(220, data.length * barHeight + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        onClick={(e: any) => {
          if (e?.activePayload?.[0]) {
            const opp = e.activePayload[0].payload as AgingOpportunity;
            if (opp.accountId) router.push(`/accounts/${opp.accountId}`);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "var(--color-ink-muted)" as string }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 10, fill: "var(--color-ink-muted)" as string }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => truncate(v, 26)}
        />
        <Tooltip content={<CustomTooltip instanceUrl={instanceUrl} />} cursor={{ fill: "color-mix(in srgb, var(--color-ink) 5%, transparent)" }} />
        <Bar dataKey="daysStalled" radius={[0, 3, 3, 0]}>
          {data.map((opp, i) => (
            <Cell
              key={i}
              fill={stallColor(maxDays > 0 ? Math.min(opp.daysStalled / maxDays, 1) : 0)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
