"use client";

import type { AgentforceResultGroup, AgentforceResultRecord, AgentforceAggregateSummary } from "@/lib/agentforce-types";

interface Props {
  results?: AgentforceResultGroup[];
  summaries?: AgentforceAggregateSummary[];
  instanceUrl?: string;
}

function sanitizeAggregateHtml(html: string): string {
  return html.replace(/<(?!\/?(?:strong|em|b|i)\b)[^>]+>/gi, "");
}

export default function AgentforceResults({ results, summaries, instanceUrl }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px", width: "100%" }}>
      {summaries && summaries.map((s, i) => (
        <div
          key={`summary-${i}`}
          dangerouslySetInnerHTML={{ __html: sanitizeAggregateHtml(s.html) }}
          style={{
            background: "var(--color-surface)",
            border: "0.5px solid var(--color-border)",
            borderRadius: "4px",
            padding: "10px 12px",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            lineHeight: 1.5,
            color: "var(--color-ink)",
          }}
        ></div>
      ))}
      {results && results.map((group) => (
        <div key={group.objectType}>
          <div style={{
            fontFamily: "var(--font-body)",
            fontSize: "10px",
            color: "var(--color-ink-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "4px",
            paddingLeft: "2px",
          }}>
            {group.records.length} {group.label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {group.records.map((record) => (
              <RecordCard key={record.id} record={record} instanceUrl={instanceUrl} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordCard({ record, instanceUrl }: { record: AgentforceResultRecord; instanceUrl?: string }) {
  const displayableFields = Object.entries(record.fields)
    .filter(([key]) => !["Id", "CreatedDate"].includes(key))
    .slice(0, 4);

  const sfLink = instanceUrl ? `${instanceUrl}/lightning/r/${record.id}/view` : null;

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "0.5px solid var(--color-border)",
      padding: "8px 10px",
      width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--color-ink)",
        }}>
          {record.title}
        </div>
        {sfLink && (
          <a
            href={sfLink}
            target="_blank"
            rel="noopener noreferrer"
            title="View in Salesforce"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              color: "var(--color-accent-text)",
              textDecoration: "none",
              opacity: 0.7,
              flexShrink: 0,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >
            ↗
          </a>
        )}
      </div>
      {displayableFields.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "1px 8px",
          marginTop: "5px",
          fontFamily: "var(--font-body)",
          fontSize: "11px",
        }}>
          {displayableFields.map(([key, value]) => (
            <div key={key} style={{ display: "contents" }}>
              <span style={{ color: "var(--color-ink-soft)", textAlign: "right", paddingTop: "1px" }}>
                {humanizeFieldName(key)}
              </span>
              <span
                style={{
                  color: "var(--color-ink)",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                }}
                title={value}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function humanizeFieldName(key: string): string {
  return key.replace(/([A-Z])/g, " $1").trim();
}
