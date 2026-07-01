import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeRelationshipDashboard } from "./home-relationship-dashboard";

const baseInput = {
  accountCount: 40,
  recentlyTouchedCount: 9,
  staleAccountCount: 12,
  pipelineStages: [
    { StageName: "Qualification", cnt: 3, totalAmt: 900_000 },
    { StageName: "Proposal/Price Quote", cnt: 2, totalAmt: 2_100_000 },
    { StageName: "Negotiation/Review", cnt: 1, totalAmt: 500_000 },
  ],
  highPriorityCases: [
    {
      id: "case-1",
      subject: "Treasury escalation",
      accountId: "acct-1",
      accountName: "Halsted Restaurant Group",
      status: "New",
      createdDate: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "case-2",
      subject: "Card dispute",
      accountId: "acct-1",
      accountName: "Halsted Restaurant Group",
      status: "Working",
      createdDate: "2026-07-01T10:00:00.000Z",
    },
    {
      id: "case-3",
      subject: "Wire question",
      accountId: "acct-2",
      accountName: "Mendez Family",
      status: "New",
      createdDate: "2026-07-01T09:00:00.000Z",
    },
  ],
  agendaItems: [
    {
      id: "event-1",
      type: "event" as const,
      subject: "Portfolio review",
      relatedName: "Okonkwo Family",
      relatedId: "acct-3",
    },
  ],
  recentAccounts: [
    {
      id: "acct-4",
      name: "Brennan Family",
      industry: "Wealth",
      lastModifiedDate: "2026-07-01T08:00:00.000Z",
    },
  ],
};

test("buildHomeRelationshipDashboard allocates pipeline dollars by stage", () => {
  const dashboard = buildHomeRelationshipDashboard(baseInput);

  assert.equal(dashboard.pipeline.totalAmount, 3_500_000);
  assert.deepEqual(dashboard.pipeline.slices.map((slice) => slice.stageName), [
    "Proposal/Price Quote",
    "Qualification",
    "Negotiation/Review",
  ]);
  assert.equal(dashboard.pipeline.slices[0].amountLabel, "$2.1M");
  assert.equal(dashboard.pipeline.slices[0].percent, 60);
  assert.match(dashboard.pipeline.takeaway, /Proposal\/Price Quote holds 60%/);
});

test("buildHomeRelationshipDashboard summarizes relationship coverage", () => {
  const dashboard = buildHomeRelationshipDashboard(baseInput);

  assert.equal(dashboard.coverage.totalCount, 40);
  assert.equal(dashboard.coverage.segments[0].id, "recent");
  assert.equal(dashboard.coverage.segments[0].count, 9);
  assert.equal(dashboard.coverage.segments[0].percent, 23);
  assert.equal(dashboard.coverage.segments[1].id, "stale");
  assert.equal(dashboard.coverage.segments[1].count, 12);
  assert.equal(dashboard.coverage.segments[2].id, "unclassified");
  assert.equal(dashboard.coverage.segments[2].count, 19);
  assert.match(dashboard.coverage.takeaway, /12 relationships are stale or missing activity/);
});

test("buildHomeRelationshipDashboard groups service pressure by account", () => {
  const dashboard = buildHomeRelationshipDashboard(baseInput);

  assert.deepEqual(dashboard.servicePressure.rows.map((row) => row.accountName), [
    "Halsted Restaurant Group",
    "Mendez Family",
  ]);
  assert.equal(dashboard.servicePressure.rows[0].caseCount, 2);
  assert.equal(dashboard.servicePressure.rows[0].href, "/accounts/acct-1");
  assert.match(dashboard.servicePressure.takeaway, /Halsted Restaurant Group has 2 high-priority cases/);
});

test("buildHomeRelationshipDashboard ranks next relationship actions", () => {
  const dashboard = buildHomeRelationshipDashboard(baseInput);

  assert.deepEqual(dashboard.nextActions.map((action) => action.id), [
    "service",
    "stale-coverage",
    "agenda",
    "movement",
  ]);
  assert.match(dashboard.nextActions[0].detail, /Treasury escalation/);
  assert.match(dashboard.nextActions[1].detail, /12 stale or no-activity relationships/);
  assert.match(dashboard.nextActions[2].detail, /Portfolio review/);
});

test("buildHomeRelationshipDashboard gives actions destination context", () => {
  const dashboard = buildHomeRelationshipDashboard(baseInput);

  assert.equal(dashboard.nextActions[0].title, "Halsted Restaurant Group");
  assert.match(dashboard.nextActions[0].detail, /Treasury escalation/);
  assert.equal(dashboard.nextActions[0].href, "/accounts/acct-1");
  assert.equal(dashboard.nextActions[1].title, "Needs-attention accounts");
  assert.equal(dashboard.nextActions[1].href, "/accounts?filter=needs-attention");
  assert.match(dashboard.nextActions[1].detail, /across your book/);
});
