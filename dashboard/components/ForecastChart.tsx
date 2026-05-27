"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector,
} from "recharts";

export interface ForecastBucket {
  label: string;
  range: string;
  amount: number;
  count: number;
}

// CSS variable names for the four donut segments, in order
const TOKEN_NAMES = [
  "--color-accent",
  "--color-accent-soft",
  "--color-ink-muted",
  "--color-ink-soft",
] as const;

const FALLBACKS = ["#946F1F", "#C7A968", "#5A5D67", "#8A8D95"];

function resolveTokens(): string[] {
  const cs = getComputedStyle(document.documentElement);
  return TOKEN_NAMES.map((t, i) => cs.getPropertyValue(t).trim() || FALLBACKS[i]);
}

function useDonutColors(): string[] {
  const [colors, setColors] = useState<string[]>(FALLBACKS);

  useEffect(() => {
    const refresh = () => setColors(resolveTokens());
    refresh();
    window.addEventListener("theme-changed", refresh);
    window.addEventListener("branding-reset", refresh);
    return () => {
      window.removeEventListener("theme-changed", refresh);
      window.removeEventListener("branding-reset", refresh);
    };
  }, []);

  return colors;
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function fmtFull(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

// Custom tooltip
function DonutTooltip({ active, payload, total }: { active?: boolean; payload?: any[]; total: number }) {
  if (!active || !payload?.length) return null;
  const d: ForecastBucket = payload[0].payload;
  const pct = total > 0 ? Math.round((d.amount / total) * 100) : 0;
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "0.5px solid var(--color-border)",
      padding: "8px 12px",
      fontFamily: "var(--font-body)",
      fontSize: "11px",
      pointerEvents: "none",
    }}>
      <p style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 3 }}>{d.label}</p>
      <p style={{ color: "var(--color-ink)", marginBottom: 2 }}>{fmtFull(d.amount)}</p>
      <p style={{ color: "var(--color-ink-soft)", marginBottom: 2 }}>{d.count} opportunit{d.count !== 1 ? "ies" : "y"}</p>
      <p style={{ color: "var(--color-ink-soft)", marginBottom: 2 }}>{d.range}</p>
      <p style={{ color: "var(--color-ink-muted)" }}>{pct}% of forecast</p>
    </div>
  );
}

// Active (hovered) shape — expands the segment outward
function ActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle,
    fill, strokeWidth, stroke,
  } = props;

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}


export default function ForecastChart({ buckets }: { buckets: ForecastBucket[] }) {
  const colors = useDonutColors();
  const total = buckets.reduce((s, b) => s + b.amount, 0);

  // paper color for stroke between segments
  const [paperColor, setPaperColor] = useState("#F4F1EA");
  useEffect(() => {
    const refresh = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim();
      if (v) setPaperColor(v);
    };
    refresh();
    window.addEventListener("theme-changed", refresh);
    window.addEventListener("branding-reset", refresh);
    return () => {
      window.removeEventListener("theme-changed", refresh);
      window.removeEventListener("branding-reset", refresh);
    };
  }, []);

  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink-soft)" }}>
        No forecast data
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Donut */}
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={buckets}
              dataKey="amount"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              startAngle={90}
              endAngle={-270}
              stroke={paperColor}
              strokeWidth={2}
              activeShape={ActiveShape}
              label={false}
              labelLine={false}
            >
              {buckets.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — HTML overlay positioned over the donut hole */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: "9px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-ink-soft)",
            marginBottom: 4,
          }}>
            Total Forecast
          </p>
          <p style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 500,
            color: "var(--color-ink)",
            lineHeight: 1,
          }}>
            {fmtShort(total)}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px 4px" }}>
        {buckets.map((b, i) => {
          const pct = total > 0 ? Math.round((b.amount / total) * 100) : 0;
          return (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, background: colors[i % colors.length], flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink)", flex: 1 }}>
                {b.label}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", marginRight: 8 }}>
                {pct}%
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "var(--color-ink)" }}>
                {fmtShort(b.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
