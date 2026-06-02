"use client";

import { useEffect, useState } from "react";
import type { FinancialAccountTransaction } from "@/lib/financial-accounts";

interface Props {
  financialAccountId: string;
  accountCurrencyIso: string;
}

export default function FinancialAccountTransactions({
  financialAccountId,
  accountCurrencyIso,
}: Props) {
  const [transactions, setTransactions] = useState<FinancialAccountTransaction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/financial-accounts/${financialAccountId}/transactions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (active) {
          setTransactions(data.transactions ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [financialAccountId]);

  const formatCurrency = (n: number | null) => {
    if (n === null) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: accountCurrencyIso || "USD",
    }).format(n);
  };

  const formatDate = (s: string | null) => {
    if (!s) return "";
    return new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const listStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    paddingTop: 8,
    borderTop: "0.5px solid var(--color-border)",
    marginTop: 8,
  };

  const stateStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    color: "var(--color-ink-soft)",
    padding: "12px 0",
    fontStyle: "italic",
    textAlign: "center",
  };

  if (loading) return <div style={stateStyle}>Loading transactions…</div>;

  if (error)
    return (
      <div style={{ ...stateStyle, color: "var(--color-danger)" }}>
        Couldn't load transactions: {error}
      </div>
    );

  if (!transactions || transactions.length === 0)
    return <div style={stateStyle}>No transactions on this account.</div>;

  const visible = transactions.slice(0, visibleCount);
  const remaining = transactions.length - visibleCount;

  return (
    <div style={listStyle}>
      {visible.map((t) => {
        const isDebit = t.DebitCreditIndicator === "Debit";
        const amount = t.Amount ?? 0;
        const displayAmount = isDebit ? -Math.abs(amount) : Math.abs(amount);

        return (
          <div
            key={t.Id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              padding: "6px 0",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              borderBottom: "0.5px solid var(--color-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                flex: 1,
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-ink-soft)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  TXN {formatDate(t.TransactionDate)}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-ink-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  POSTED {t.PostedDate ? formatDate(t.PostedDate) : "—"}
                </span>
              </div>
              <span
                style={{
                  color: "var(--color-ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.Description || t.Name || t.TransactionCode || "Transaction"}
              </span>
              {t.Type && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-ink-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t.Type}
                </span>
              )}
            </div>
            <span
              style={{
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                color: isDebit ? "var(--color-danger)" : "var(--color-success)",
                flexShrink: 0,
              }}
            >
              {formatCurrency(displayAmount)}
            </span>
          </div>
        );
      })}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount(visibleCount + 10)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-accent-text)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            cursor: "pointer",
            padding: "8px 0 4px",
            textAlign: "left",
          }}
        >
          Show {Math.min(remaining, 10)} more ({remaining} remaining)
        </button>
      )}
    </div>
  );
}
