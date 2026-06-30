"use client";

import type { RelationshipSnapshot, SnapshotSeverity } from "@/lib/relationship-snapshot";

type Props = {
  snapshot: RelationshipSnapshot;
};

function severityColor(severity: SnapshotSeverity): string {
  if (severity === "risk") return "var(--color-danger)";
  if (severity === "watch") return "var(--color-warning)";
  if (severity === "empty") return "var(--color-ink-soft)";
  return "var(--color-success)";
}

export default function RelationshipSnapshotPanel({ snapshot }: Props) {
  function ask(question: string) {
    window.dispatchEvent(
      new CustomEvent("chat:ask", {
        detail: {
          question,
          accountId: snapshot.accountId,
        },
      })
    );
  }

  return (
    <section
      aria-labelledby="relationship-snapshot-title"
      className="mb-8"
      style={{
        background: "var(--color-surface)",
        border: "0.5px solid var(--color-border)",
      }}
    >
      <div
        className="px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        style={{ borderBottom: "0.5px solid var(--color-border)" }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-ink-soft)",
              marginBottom: 4,
            }}
          >
            Relationship Snapshot
          </p>
          <h2
            id="relationship-snapshot-title"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--color-ink)",
              margin: 0,
            }}
          >
            {snapshot.accountName}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {snapshot.prompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => ask(prompt.question)}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--color-accent-text)",
                background: "var(--color-paper)",
                border: "0.5px solid var(--color-border)",
                padding: "7px 10px",
              }}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        }}
      >
        {snapshot.signals.map((signal) => (
          <article
            key={signal.id}
            className="px-5 py-4"
            style={{
              borderRight: "0.5px solid var(--color-border)",
              minHeight: 158,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-soft)",
                  margin: 0,
                }}
              >
                {signal.label}
              </p>
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  background: severityColor(signal.severity),
                  borderRadius: 999,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            </div>

            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 600,
                color: "var(--color-ink)",
                margin: "0 0 8px",
              }}
            >
              {signal.value}
            </p>

            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--color-ink-muted)",
                margin: "0 0 14px",
              }}
            >
              {signal.detail}
            </p>

            <div className="flex flex-wrap gap-2">
              {signal.metrics.map((metric) => (
                <span
                  key={metric.label}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 10,
                    color: "var(--color-ink-soft)",
                    background: "var(--color-paper)",
                    border: "0.5px solid var(--color-border)",
                    padding: "4px 6px",
                  }}
                >
                  {metric.label}:{" "}
                  <strong style={{ color: "var(--color-ink)", fontWeight: 500 }}>
                    {metric.value}
                  </strong>
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
