"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SFPipelineStage } from "@/lib/salesforce";

function formatAxisAmount(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatTooltipAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Blue gradient shades for bars
const BAR_COLORS = [
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
];

interface TooltipPayloadItem {
  value: number;
  payload: { count: number };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const { value, payload: { count } } = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-gray-600">{formatTooltipAmount(value)}</p>
      <p className="text-gray-400">{count} opportunity{count !== 1 ? "ies" : "y"}</p>
    </div>
  );
}

export default function PipelineChart({ stages }: { stages: SFPipelineStage[] }) {
  const data = stages.map((s) => ({
    name: s.StageName,
    amount: s.totalAmt ?? 0,
    count: s.cnt,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
        No open pipeline data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={data.length > 4 ? -25 : 0}
          textAnchor={data.length > 4 ? "end" : "middle"}
          height={data.length > 4 ? 48 : 24}
        />
        <YAxis
          tickFormatter={formatAxisAmount}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
