"use client";

import { useState } from "react";
import type { FinancialAccountWithRole } from "@/lib/financial-accounts";
import { categorizeFinancialAccount } from "@/lib/financial-accounts";
import FinancialAccountTransactions from "./FinancialAccountTransactions";

interface Props {
  account: FinancialAccountWithRole;
}

const badge: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 7px",
  borderRadius: 10,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
};

const badgeSuccess: React.CSSProperties = {
  ...badge,
  background: "rgba(45, 106, 79, 0.15)",
  color: "#2D6A4F",
};

const badgeNeutral: React.CSSProperties = {
  ...badge,
  background: "var(--color-border)",
  color: "var(--color-ink-muted)",
};

const badgeRole: React.CSSProperties = {
  ...badge,
  background: "rgba(160, 104, 0, 0.12)",
  color: "#A06800",
};

const badgeInfo: React.CSSProperties = {
  ...badge,
  background: "rgba(30, 64, 175, 0.10)",
  color: "#1E40AF",
};

export default function FinancialAccountCard({ account }: Props) {
  const [expanded, setExpanded] = useState(false);
  const category = categorizeFinancialAccount(account.Type);

  const formatCurrency = (n: number | null) => {
    if (n === null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account.CurrencyIsoCode || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  };

  const formatDate = (s: string | null) => {
    if (!s) return null;
    return new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const maskedAcctNumber = account.FinancialAccountNumber
    ? `••• ${account.FinancialAccountNumber.slice(-4)}`
    : null;

  // Balance display: prefer CurrentBalance; lending falls back to TotalOutstandingAmount
  const balanceAmount =
    account.CurrentBalance !== null
      ? account.CurrentBalance
      : (category === "Lending" || category === "Credit")
        ? account.TotalOutstandingAmount
        : null;
  const balanceLabel =
    account.CurrentBalance !== null ? "Current Balance" : "Outstanding Balance";
  const balanceAsOf = account.CurrentBalance !== null ? account.BalanceAsOfDate : null;

  // Type-specific fields — Overdraft moves to badge, no longer in grid
  const lendingFields =
    category === "Lending" || category === "Credit"
      ? [
          { label: "Principal", value: formatCurrency(account.PrincipalAmount) },
          { label: "Rate", value: account.InterestRate !== null ? `${account.InterestRate}%` : null },
          { label: "Term", value: account.Term ? `${account.Term} mo` : null },
          { label: "Due", value: formatCurrency(account.AmountDue) },
          { label: "Payment Due", value: formatDate(account.PaymentDueDate) },
          { label: "Maturity", value: formatDate(account.MaturityDate) },
        ].filter((f) => f.value !== null)
      : [];

  const depositFields =
    category === "Deposit"
      ? [{ label: "Opened", value: formatDate(account.OpeningDate) }].filter(
          (f) => f.value !== null
        )
      : [];

  const investmentFields =
    category === "Investment"
      ? [
          { label: "Managed", value: account.IsManaged ? "Yes" : "No" },
          { label: "Opened", value: formatDate(account.OpeningDate) },
        ].filter((f) => f.value !== null)
      : [];

  const fields = [...lendingFields, ...depositFields, ...investmentFields];

  const statusIsInactive =
    account.Status?.toLowerCase() === "closed" ||
    account.Status?.toLowerCase() === "inactive";

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "0.5px solid var(--color-border)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-ink)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {account.Name}
          </span>
          {maskedAcctNumber && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-soft)",
              }}
            >
              {maskedAcctNumber}
            </span>
          )}
        </div>

        {/* Badges */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            flexShrink: 0,
            justifyContent: "flex-end",
            maxWidth: "55%",
          }}
        >
          {account.Status && (
            <span style={statusIsInactive ? badgeNeutral : badgeSuccess}>
              {account.Status}
            </span>
          )}
          <span style={badgeRole}>{account.Role}</span>
          {category === "Deposit" && account.IsOverdraftAllowed && (
            <span style={badgeInfo} title="Overdraft is allowed on this account">
              Overdraft OK
            </span>
          )}
        </div>
      </div>

      {/* Balance — primary value */}
      {balanceAmount !== null && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "12px 0",
            marginBottom: fields.length > 0 ? 8 : 4,
            borderBottom: fields.length > 0 ? "0.5px solid var(--color-border)" : "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--color-ink-soft)",
            }}
          >
            {balanceLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 600,
              color: "var(--color-ink)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            {formatCurrency(balanceAmount)}
          </span>
          {balanceAsOf && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 10,
                color: "var(--color-ink-soft)",
                fontStyle: "italic",
              }}
            >
              as of {formatDate(balanceAsOf)}
            </span>
          )}
        </div>
      )}

      {/* Type-specific fields */}
      {fields.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "10px 16px",
            marginBottom: 12,
          }}
        >
          {fields.map((f, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--color-ink-soft)",
                }}
              >
                {f.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--color-ink)",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {f.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Transactions toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-accent-text)",
          fontFamily: "var(--font-body)",
          fontSize: 12,
          cursor: "pointer",
          padding: "4px 0",
          display: "block",
        }}
      >
        {expanded ? "− Hide transactions" : "+ Show transactions"}
      </button>

      {expanded && (
        <FinancialAccountTransactions
          financialAccountId={account.Id}
          accountCurrencyIso={account.CurrencyIsoCode}
        />
      )}
    </div>
  );
}
