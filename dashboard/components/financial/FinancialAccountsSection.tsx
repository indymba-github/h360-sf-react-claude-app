"use client";

import type {
  FinancialAccountWithRole,
  FinancialAccountCategory,
} from "@/lib/financial-accounts";
import {
  categorizeFinancialAccount,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from "@/lib/financial-accounts";
import FinancialAccountCard from "./FinancialAccountCard";

interface Props {
  accounts: FinancialAccountWithRole[];
}

export default function FinancialAccountsSection({ accounts }: Props) {
  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--color-ink)",
    margin: "0 0 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  if (!accounts || accounts.length === 0) {
    return (
      <div style={{ padding: "24px 0" }}>
        <h3 style={sectionTitleStyle}>Financial Accounts</h3>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--color-ink-soft)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          No financial accounts on this account.
        </p>
      </div>
    );
  }

  const grouped = new Map<FinancialAccountCategory, FinancialAccountWithRole[]>();
  for (const acct of accounts) {
    const cat = categorizeFinancialAccount(acct.Type);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(acct);
  }

  return (
    <div style={{ padding: "24px 0" }}>
      <h3 style={sectionTitleStyle}>
        Financial Accounts
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-ink-soft)",
            background: "var(--color-surface)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {accounts.length}
        </span>
      </h3>

      {CATEGORY_ORDER.map((category) => {
        const items = grouped.get(category);
        if (!items || items.length === 0) return null;

        return (
          <div key={category} style={{ marginBottom: 20 }}>
            <h4
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "var(--color-ink-soft)",
                margin: "0 0 8px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {CATEGORY_LABELS[category]}
              <span
                style={{
                  fontSize: 10,
                  color: "var(--color-ink-soft)",
                  fontWeight: 400,
                }}
              >
                {items.length}
              </span>
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {items.map((acct) => (
                <FinancialAccountCard key={acct.Id} account={acct} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
