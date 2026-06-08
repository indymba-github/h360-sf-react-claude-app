"use client";

import {
  SF_PROVIDER_ORDER,
  groupModelsByProvider,
  findModelByApiName,
} from "@/lib/salesforce-models-catalog";

type Props = {
  value: string;
  onChange: (apiName: string) => void;
};

export default function ModelPicker({ value, onChange }: Props) {
  const grouped = groupModelsByProvider();
  const current = findModelByApiName(value);

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "0.5px solid var(--color-border)",
    borderRadius: 0,
    background: "var(--color-paper)",
    color: "var(--color-text)",
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    cursor: "pointer",
    width: "100%",
    maxWidth: 480,
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
        onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent-soft)"; }}
        onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
      >
        {SF_PROVIDER_ORDER.map((provider) => (
          <optgroup key={provider} label={provider}>
            {(grouped.get(provider) ?? []).map((m) => (
              <option key={m.apiName} value={m.apiName}>
                {m.label}{m.beta ? " (Beta)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {current && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-block",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 10,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-body)",
                background: current.insideTrustBoundary
                  ? "color-mix(in srgb, #2D6A4F 12%, transparent)"
                  : "color-mix(in srgb, #A06800 12%, transparent)",
                color: current.insideTrustBoundary ? "#2D6A4F" : "#A06800",
              }}
            >
              {current.insideTrustBoundary
                ? "Inside Salesforce Trust Boundary"
                : "Salesforce Partner"}
            </span>
            {current.beta && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontFamily: "var(--font-body)",
                  background: "color-mix(in srgb, #1E40AF 12%, transparent)",
                  color: "#1E40AF",
                }}
              >
                Beta
              </span>
            )}
          </div>
          {current.notes && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "var(--color-ink-soft)",
                fontStyle: "italic",
                margin: 0,
              }}
            >
              {current.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
