"use client";

import type { AgentforceRecordChoice } from "@/lib/agentforce-types";

interface Props {
  choices: AgentforceRecordChoice[];
  onSelect: (choice: AgentforceRecordChoice) => void;
  disabled?: boolean;
}

export default function AgentforceChoices({ choices, onSelect, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px", width: "100%" }}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(choice)}
          style={{
            textAlign: "left",
            background: "var(--color-paper)",
            border: "0.5px solid var(--color-border)",
            padding: "8px 12px",
            cursor: disabled ? "not-allowed" : "pointer",
            width: "100%",
            opacity: disabled ? 0.5 : 1,
            transition: "border-color 120ms ease, background 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (disabled) return;
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)";
            (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 5%, var(--color-paper))";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
            (e.currentTarget as HTMLElement).style.background = "var(--color-paper)";
          }}
        >
          <div style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)", marginBottom: choice.type || choice.subtitle ? "2px" : 0 }}>
            {choice.title}
          </div>
          {(choice.type || choice.subtitle) && (
            <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
              {choice.type}
              {choice.type && choice.subtitle && (
                <span style={{ color: "var(--color-ink-muted)", margin: "0 4px" }}>·</span>
              )}
              {choice.subtitle}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
