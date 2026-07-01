import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountsDirectory,
  filterAccountsDirectoryCards,
  normalizeAccountsDirectoryQuery,
  normalizeAccountsQuickFilter,
} from "./accounts-directory";
import type { SFAccount } from "./salesforce";

function account(overrides: Partial<SFAccount>): SFAccount {
  return {
    Id: "acct-1",
    Name: "Halsted Restaurant Group",
    Industry: "Hospitality",
    AnnualRevenue: 4_500_000,
    NumberOfEmployees: 125,
    BillingState: "IN",
    BillingCity: "Indianapolis",
    Phone: null,
    Website: null,
    Type: "Commercial",
    Description: null,
    CreatedDate: "2025-01-01T00:00:00.000Z",
    LastModifiedDate: "2026-06-30T00:00:00.000Z",
    LastActivityDate: "2026-06-25",
    Owner: { Name: "Michael Shirrell" },
    ...overrides,
  };
}

const now = new Date("2026-07-01T12:00:00.000Z");

test("buildAccountsDirectory summarizes recent, stale, and incomplete visible accounts", () => {
  const directory = buildAccountsDirectory({
    accounts: [
      account({ Id: "recent", LastActivityDate: "2026-06-25" }),
      account({
        Id: "stale",
        Name: "Brennan Family",
        AnnualRevenue: null,
        NumberOfEmployees: null,
        LastActivityDate: "2026-02-01",
      }),
      account({
        Id: "quiet",
        Name: "Mendez Family",
        Industry: null,
        AnnualRevenue: null,
        NumberOfEmployees: null,
        BillingCity: null,
        BillingState: null,
        LastActivityDate: null,
      }),
    ],
    totalCount: 10,
    starredIds: ["recent"],
    now,
  });

  assert.equal(directory.summary.totalCount, 10);
  assert.equal(directory.summary.visibleCount, 3);
  assert.equal(directory.summary.recentlyTouchedCount, 1);
  assert.equal(directory.summary.staleCount, 2);
  assert.equal(directory.summary.dataGapCount, 2);
  assert.equal(directory.summary.needsAttentionCount, 2);
});

test("buildAccountsDirectory creates display metadata for account cards", () => {
  const directory = buildAccountsDirectory({
    accounts: [
      account({ Id: "recent", LastActivityDate: "2026-06-25" }),
      account({
        Id: "stale",
        Name: "Brennan Family",
        AnnualRevenue: null,
        NumberOfEmployees: null,
        LastActivityDate: "2026-02-01",
      }),
    ],
    totalCount: 2,
    starredIds: ["recent"],
    now,
  });

  const recent = directory.cards.find((card) => card.id === "recent");
  assert.ok(recent);
  assert.equal(recent.marketLabel, "Indianapolis, IN");
  assert.equal(recent.revenueLabel, "$4.5M");
  assert.equal(recent.employeesLabel, "125");
  assert.equal(recent.lastActivityLabel, "Jun 25, 2026");
  assert.equal(recent.activityTone, "recent");
  assert.equal(recent.isStarred, true);
  assert.equal(recent.needsAttention, false);

  const stale = directory.cards.find((card) => card.id === "stale");
  assert.ok(stale);
  assert.equal(stale.activityTone, "stale");
  assert.equal(stale.needsAttention, true);
  assert.match(stale.statusLine, /Stale relationship/);
  assert.deepEqual(stale.dataGaps, ["Revenue", "Employees"]);
  assert.deepEqual(stale.attentionReasons, [
    "Stale activity",
    "Missing revenue",
    "Missing employees",
  ]);
  assert.equal(stale.relationshipAction, "Schedule outreach and fill key account gaps.");
});

test("filterAccountsDirectoryCards supports starred, recent, and needs-attention quick filters", () => {
  const directory = buildAccountsDirectory({
    accounts: [
      account({ Id: "recent", LastActivityDate: "2026-06-25" }),
      account({ Id: "older", LastActivityDate: "2026-05-01" }),
      account({ Id: "stale", AnnualRevenue: null, NumberOfEmployees: null, LastActivityDate: "2026-02-01" }),
    ],
    totalCount: 3,
    starredIds: ["older"],
    now,
  });

  assert.deepEqual(filterAccountsDirectoryCards(directory.cards, "all").map((card) => card.id), ["recent", "older", "stale"]);
  assert.deepEqual(filterAccountsDirectoryCards(directory.cards, "starred").map((card) => card.id), ["older"]);
  assert.deepEqual(filterAccountsDirectoryCards(directory.cards, "recent").map((card) => card.id), ["recent"]);
  assert.deepEqual(filterAccountsDirectoryCards(directory.cards, "needs-attention").map((card) => card.id), ["stale"]);
});

test("normalizeAccountsQuickFilter reads supported URL filters", () => {
  assert.equal(normalizeAccountsQuickFilter("needs-attention"), "needs-attention");
  assert.equal(normalizeAccountsQuickFilter("recent"), "recent");
  assert.equal(normalizeAccountsQuickFilter(["starred"]), "starred");
  assert.equal(normalizeAccountsQuickFilter("unknown"), "all");
  assert.equal(normalizeAccountsQuickFilter(undefined), "all");
});

test("normalizeAccountsDirectoryQuery makes URL state deterministic", () => {
  assert.deepEqual(
    normalizeAccountsDirectoryQuery({
      filter: "needs-attention",
      sortBy: "last-activity-desc",
      search: "Halsted",
      industry: "Hospitality",
    }),
    {
      filter: "needs-attention",
      sortBy: "last-activity-desc",
      search: "Halsted",
      industry: "Hospitality",
    },
  );

  assert.deepEqual(
    normalizeAccountsDirectoryQuery({
      filter: "bad",
      sortBy: "bad",
      search: "   ",
      industry: "",
    }),
    {
      filter: "all",
      sortBy: "name-asc",
      search: "",
      industry: "all",
    },
  );

  assert.equal(normalizeAccountsDirectoryQuery({ search: ["Mendez", "Ignored"] }).search, "Mendez");
});
