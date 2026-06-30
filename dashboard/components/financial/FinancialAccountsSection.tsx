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
  if (!accounts || accounts.length === 0) {
    return (
      <div
        className="px-5 py-8 text-center"
        style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--color-ink-soft)",
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
    <div>
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
