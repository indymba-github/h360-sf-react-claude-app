import assert from "node:assert/strict";
import test from "node:test";

import { formatFinancialAccountsSummary, supplementTrustLayerMcpContext } from "./trust-layer-context";
import type { FinancialAccountWithRole } from "./financial-accounts";

function financialAccount(overrides: Partial<FinancialAccountWithRole>): FinancialAccountWithRole {
  return {
    Id: "fin-1",
    Name: "Checking",
    FinancialAccountNumber: null,
    Type: "Checking",
    Status: "Open",
    OpeningDate: null,
    ClosingDate: null,
    MaturityDate: null,
    RenewalDate: null,
    PaymentDueDate: null,
    PrincipalAmount: null,
    TotalOutstandingAmount: null,
    AmountDue: null,
    InterestRate: null,
    InterestType: null,
    DownPaymentAmount: null,
    Term: null,
    CreditLimit: null,
    PrincipalPaidYearToDate: null,
    InterestPaidYearToDate: null,
    IsOverdraftAllowed: false,
    IsManaged: false,
    BankerId: null,
    BranchUnitId: null,
    ProductId: null,
    CurrencyIsoCode: "USD",
    Role: "Owner",
    PartyId: "party-1",
    CurrentBalance: null,
    BalanceAsOfDate: null,
    ...overrides,
  };
}

test("formatFinancialAccountsSummary describes FINS exposure semantics", () => {
  const summary = formatFinancialAccountsSummary([
    financialAccount({ Id: "fin-1", Name: "Primary Checking", Type: "Checking", CurrentBalance: 40_000 }),
    financialAccount({ Id: "fin-2", Name: "Mortgage", Type: "Mortgage", TotalOutstandingAmount: 300_000 }),
    financialAccount({ Id: "fin-3", Name: "Rewards Card", Type: "Credit Card", CreditLimit: 25_000 }),
  ]);

  assert.match(summary, /Primary Checking \| Checking \[Owner\] \| Asset balance: \$40K/);
  assert.match(summary, /Mortgage \| Mortgage \[Owner\] \| Debt exposure: \$300K/);
  assert.match(summary, /Rewards Card \| Credit Card \[Owner\] \| Credit exposure: \$25K/);
  assert.doesNotMatch(summary, /\(no balance\)/);
});

test("formatFinancialAccountsSummary marks unavailable value data without implying zero", () => {
  const summary = formatFinancialAccountsSummary([
    financialAccount({ Id: "fin-1", Name: "Primary Checking", Type: "Checking" }),
  ]);

  assert.match(summary, /Primary Checking \| Checking \[Owner\] \| Value data unavailable/);
});

test("supplementTrustLayerMcpContext appends REST financial context when MCP lacks it", () => {
  const result = supplementTrustLayerMcpContext(
    { text: "ACCOUNT\nName: Halsted Restaurant Group", source: "mcp" },
    "FINANCIAL ACCOUNTS\n  • Operating Checking | Checking | Asset balance: $450K",
  );

  assert.equal(result.source, "mcp+rest");
  assert.match(result.text, /ACCOUNT\nName: Halsted Restaurant Group/);
  assert.match(result.text, /REST FINANCIAL ACCOUNT CONTEXT/);
  assert.match(result.text, /Asset balance: \$450K/);
});

test("supplementTrustLayerMcpContext does not duplicate existing MCP financial context", () => {
  const result = supplementTrustLayerMcpContext(
    { text: "FINANCIAL ACCOUNTS\n  • Existing MCP account", source: "mcp" },
    "FINANCIAL ACCOUNTS\n  • REST account",
  );

  assert.equal(result.source, "mcp");
  assert.doesNotMatch(result.text, /REST account/);
});
