"use client";

import { useEffect, useState } from "react";
import type { AgentforceResultGroup, AgentforceResultRecord, AgentforceAggregateSummary } from "@/lib/agentforce-types";

interface Props {
  results?: AgentforceResultGroup[];
  summaries?: AgentforceAggregateSummary[];
  instanceUrl?: string;
}

const ALLOWED_TAGS = new Set(["strong", "em", "b", "i", "u", "h1", "h2", "h3", "p", "ul", "ol", "li", "br"]);

function sanitizeAggregateHtml(html: string): string {
  return html
    // Strip outer <body> wrapper if present
    .replace(/^\s*<body[^>]*>([\s\S]*)<\/body>\s*$/i, "$1")
    // Convert non-standard <red> to an inline highlight span
    .replace(/<red>([\s\S]*?)<\/red>/gi, '<span style="color:#C84A3F;font-weight:600">$1</span>')
    // Strip any remaining tags not in the allowlist
    .replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (match, slash, tag) =>
      ALLOWED_TAGS.has(tag.toLowerCase()) ? match : ""
    );
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

function useFinancialAccountBalance(recordId: string, objectType?: string) {
  const [balance, setBalance] = useState<{ amount: number | null; currency: string; asOf: string | null } | null>(null);

  useEffect(() => {
    // FA IDs use the 0c7 key prefix in FSC Core
    if (!recordId || !objectType?.toLowerCase().includes("financial")) return;
    fetch(`/api/financial-accounts/${recordId}/balance`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.balance) {
          setBalance({
            amount: data.balance.Amount,
            currency: data.balance.CurrencyIsoCode ?? "USD",
            asOf: data.balance.BalanceAsOfDate,
          });
        }
      })
      .catch(() => null);
  }, [recordId, objectType]);

  return balance;
}

function formatBalanceCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function RecordCard({ record, instanceUrl }: { record: AgentforceResultRecord; instanceUrl?: string }) {
  const displayableFields = Object.entries(record.fields)
    .filter(([key]) => !["Id", "CreatedDate"].includes(key))
    .slice(0, 4);

  const sfLink = instanceUrl ? `${instanceUrl}/lightning/r/${record.id}/view` : null;
  const balance = useFinancialAccountBalance(record.id, record.objectType);

  const maskedNumber = (() => {
    const raw = Object.entries(record.fields).find(([k]) => k.toLowerCase().includes("number"))?.[1];
    if (!raw) return null;
    return raw.startsWith("XXXX") ? `••• ${raw.slice(-4)}` : raw;
  })();

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "0.5px solid var(--color-border)",
      padding: "8px 10px",
      width: "100%",
    }}>
      {/* Title row */}
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

      {/* Account number + type on same line */}
      {(maskedNumber || record.subtitle) && (
        <div style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginTop: "3px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-ink-soft)",
        }}>
          {maskedNumber && <span>{maskedNumber}</span>}
          {maskedNumber && record.subtitle && (
            <span style={{ color: "var(--color-border)", fontSize: "10px" }}>·</span>
          )}
          {record.subtitle && (
            <span style={{ fontFamily: "var(--font-body)" }}>{record.subtitle}</span>
          )}
        </div>
      )}

      {/* Balance */}
      {balance !== null && balance.amount !== null && (
        <div style={{
          marginTop: "6px",
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--color-ink)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatBalanceCurrency(balance.amount, balance.currency)}
        </div>
      )}

      {/* Remaining fields — exclude number since it's shown above */}
      {displayableFields.filter(([k]) => !k.toLowerCase().includes("number")).length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "1px 8px",
          marginTop: "5px",
          fontFamily: "var(--font-body)",
          fontSize: "11px",
        }}>
          {displayableFields
            .filter(([k]) => !k.toLowerCase().includes("number"))
            .map(([key, value]) => (
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
