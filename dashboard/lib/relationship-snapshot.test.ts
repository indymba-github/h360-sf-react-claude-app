import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationshipSnapshot } from "./relationship-snapshot";
import type { FinancialAccountWithRole } from "./financial-accounts";
import type { SFAccount, SFCase, SFContact, SFOpportunity } from "./salesforce";

const account: SFAccount = {
  Id: "001-example",
  Name: "Okonkwo Family",
  Industry: "Banking",
  AnnualRevenue: null,
  NumberOfEmployees: null,
  BillingState: "IN",
  BillingCity: "Indianapolis",
  Phone: null,
  Website: null,
  Type: "Household",
  Description: null,
  CreatedDate: "2024-01-01T00:00:00.000Z",
  LastModifiedDate: "2026-06-01T00:00:00.000Z",
  Owner: { Name: "Michael Shirrell" },
};

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

test("buildRelationshipSnapshot summarizes FINS relationship signals", () => {
  const opportunities: SFOpportunity[] = [
    {
      Id: "opp-1",
      Name: "Mortgage Refi",
      StageName: "Proposal/Price Quote",
      Amount: 2_200_000,
      CloseDate: "2026-08-26",
      Probability: 75,
    },
    {
      Id: "opp-2",
      Name: "Closed Loan",
      StageName: "Closed Won",
      Amount: 100_000,
      CloseDate: "2026-01-01",
      Probability: 100,
    },
    {
      Id: "opp-3",
      Name: "Deposit Expansion",
      StageName: "Qualification",
      Amount: 875_000,
      CloseDate: "2026-08-22",
      Probability: 20,
    },
  ];
  const contacts: SFContact[] = [
    {
      Id: "contact-1",
      Name: "Ada Okonkwo",
      Title: "Primary",
      Email: "ada@example.com",
      Phone: "555-0100",
      Department: null,
    },
    {
      Id: "contact-2",
      Name: "Nnamdi Okonkwo",
      Title: null,
      Email: null,
      Phone: null,
      Department: null,
    },
  ];
  const cases: SFCase[] = [
    {
      Id: "case-1",
      CaseNumber: "0001",
      Subject: "Wire question",
      Status: "New",
      Priority: "High",
      CreatedDate: "2026-06-15T00:00:00.000Z",
      ClosedDate: null,
      Description: null,
      Contact: null,
      Owner: null,
    },
    {
      Id: "case-2",
      CaseNumber: "0002",
      Subject: "Resolved card issue",
      Status: "Closed",
      Priority: "Medium",
      CreatedDate: "2026-05-01T00:00:00.000Z",
      ClosedDate: "2026-05-02T00:00:00.000Z",
      Description: null,
      Contact: null,
      Owner: null,
    },
  ];
  const financialAccounts = [
    financialAccount({ Id: "fin-1", Type: "Checking", CurrentBalance: 120_000 }),
    financialAccount({ Id: "fin-2", Type: "Investment Account", CurrentBalance: 450_000 }),
    financialAccount({ Id: "fin-3", Type: "Mortgage", TotalOutstandingAmount: 300_000 }),
  ];

  const snapshot = buildRelationshipSnapshot({
    account,
    opportunities,
    contacts,
    cases,
    financialAccounts,
  });

  assert.equal(snapshot.relationship.value, "$570K assets");
  assert.match(snapshot.relationship.detail, /3 accounts across 3 product areas/);
  assert.match(snapshot.relationship.detail, /\$300K debt exposure/);
  assert.deepEqual(snapshot.relationship.metrics.map((metric) => metric.label), [
    "Financial accounts",
    "Product mix",
    "Known assets",
    "Debt exposure",
  ]);

  assert.equal(snapshot.growth.value, "$3.1M");
  assert.match(snapshot.growth.detail, /Next close Aug 22, 2026/);
  assert.match(snapshot.growth.detail, /Mortgage Refi at 75%/);

  assert.equal(snapshot.service.value, "1 open");
  assert.match(snapshot.service.detail, /1 high priority/);

  assert.equal(snapshot.coverage.value, "2 contacts");
  assert.match(snapshot.coverage.detail, /50% email coverage/);
});

test("buildRelationshipSnapshot uses intentional empty states", () => {
  const snapshot = buildRelationshipSnapshot({
    account,
    opportunities: [],
    contacts: [],
    cases: [],
    financialAccounts: [],
  });

  assert.equal(snapshot.relationship.severity, "empty");
  assert.equal(snapshot.relationship.value, "No accounts");
  assert.match(snapshot.relationship.detail, /No financial accounts/);

  assert.equal(snapshot.growth.value, "No open pipeline");
  assert.equal(snapshot.service.value, "No open cases");
  assert.equal(snapshot.coverage.value, "No contacts");
});

test("buildRelationshipSnapshot headlines account count when financial value fields are unavailable", () => {
  const snapshot = buildRelationshipSnapshot({
    account,
    opportunities: [],
    contacts: [],
    cases: [],
    financialAccounts: [
      financialAccount({ Id: "fin-1", Type: "Checking" }),
      financialAccount({ Id: "fin-2", Type: "Mortgage" }),
    ],
  });

  assert.equal(snapshot.relationship.value, "2 accounts");
  assert.match(snapshot.relationship.detail, /Balance data unavailable/);
  assert.equal(
    snapshot.relationship.metrics.find((metric) => metric.label === "Known assets")?.value,
    "Unavailable"
  );
});

test("buildRelationshipSnapshot separates credit exposure from assets and debt", () => {
  const snapshot = buildRelationshipSnapshot({
    account,
    opportunities: [],
    contacts: [],
    cases: [],
    financialAccounts: [
      financialAccount({ Id: "fin-1", Type: "Savings", CurrentBalance: 40_000 }),
      financialAccount({ Id: "fin-2", Type: "Credit Card", CreditLimit: 25_000 }),
      financialAccount({ Id: "fin-3", Type: "Loan", PrincipalAmount: 90_000 }),
    ],
  });

  assert.equal(snapshot.relationship.value, "$40K assets");
  assert.match(snapshot.relationship.detail, /\$90K debt exposure/);
  assert.match(snapshot.relationship.detail, /\$25K credit exposure/);
  assert.equal(
    snapshot.relationship.metrics.find((metric) => metric.label === "Credit exposure")?.value,
    "$25K"
  );
});
