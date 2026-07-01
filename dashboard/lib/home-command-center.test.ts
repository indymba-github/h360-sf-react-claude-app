import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeCommandCenter } from "./home-command-center";

const baseInput = {
  accountCount: 42,
  openPipelineAmount: 3_400_000,
  openPipelineCount: 8,
  winRate: 55,
  modifiedThisWeek: 4,
  highPriorityCases: [
    {
      id: "case-1",
      subject: "Treasury escalation",
      accountId: "acct-1",
      accountName: "Halsted Restaurant Group",
      status: "New",
      createdDate: "2026-07-01T12:00:00.000Z",
    },
  ],
  recentAccounts: [
    {
      id: "acct-2",
      name: "Okonkwo Family",
      industry: "Financial Services",
      lastModifiedDate: "2026-07-01T09:00:00.000Z",
    },
  ],
  agendaItems: [
    {
      id: "event-1",
      type: "event" as const,
      subject: "Portfolio review",
      relatedName: "Mendez Family",
      relatedId: "acct-3",
    },
  ],
  agingOpportunities: [
    {
      id: "opp-1",
      accountId: "acct-4",
      name: "Restaurant Refinance",
      stageName: "Proposal/Price Quote",
      amount: 2_200_000,
      daysStalled: 46,
    },
    {
      id: "opp-2",
      accountId: "acct-5",
      name: "Deposit Expansion",
      stageName: "Qualification",
      amount: 875_000,
      daysStalled: 12,
    },
  ],
  forecastBuckets: [
    { label: "This month", range: "Jul 1 - Jul 31", amount: 1_200_000, count: 2 },
    { label: "Next month", range: "Aug 1 - Aug 31", amount: 2_000_000, count: 3 },
  ],
  pipelineStages: [
    { StageName: "Qualification", cnt: 3, totalAmt: 875_000 },
    { StageName: "Proposal/Price Quote", cnt: 2, totalAmt: 2_200_000 },
  ],
};

test("buildHomeCommandCenter ranks the daily focus by urgency", () => {
  const summary = buildHomeCommandCenter(baseInput);

  assert.deepEqual(summary.focusItems.map((item) => item.id), [
    "service",
    "pipeline",
    "agenda",
    "movement",
  ]);

  assert.equal(summary.focusItems[0].label, "Service escalation");
  assert.equal(summary.focusItems[0].value, "1");
  assert.match(summary.focusItems[0].detail, /Halsted Restaurant Group/);

  assert.equal(summary.focusItems[1].label, "Stalled pipeline");
  assert.equal(summary.focusItems[1].value, "$2.2M");
  assert.match(summary.focusItems[1].detail, /46 days/);
});

test("buildHomeCommandCenter creates a quiet-state focus item when no signals exist", () => {
  const summary = buildHomeCommandCenter({
    ...baseInput,
    openPipelineAmount: 0,
    openPipelineCount: 0,
    modifiedThisWeek: 0,
    highPriorityCases: [],
    recentAccounts: [],
    agendaItems: [],
    agingOpportunities: [],
    forecastBuckets: [],
    pipelineStages: [],
  });

  assert.equal(summary.focusItems.length, 1);
  assert.equal(summary.focusItems[0].id, "quiet");
  assert.equal(summary.focusItems[0].value, "Clear");
  assert.match(summary.focusItems[0].detail, /No urgent service, pipeline, agenda, or account movement signals/);
});

test("buildHomeCommandCenter builds book-health metrics with useful detail", () => {
  const summary = buildHomeCommandCenter(baseInput);

  assert.deepEqual(summary.healthMetrics.map((metric) => metric.id), [
    "pipeline",
    "stalled",
    "service",
    "coverage",
  ]);

  assert.equal(summary.healthMetrics[0].value, "$3.4M");
  assert.match(summary.healthMetrics[0].detail, /8 open opportunities/);
  assert.equal(summary.healthMetrics[1].value, "$2.2M");
  assert.match(summary.healthMetrics[1].detail, /1 opportunity stalled 30\+ days/);
  assert.equal(summary.healthMetrics[2].value, "1");
  assert.match(summary.healthMetrics[2].detail, /high-priority case/);
  assert.equal(summary.healthMetrics[3].value, "4");
  assert.match(summary.healthMetrics[3].detail, /42 owned accounts/);
});

test("buildHomeCommandCenter explains dashboard chart takeaways", () => {
  const summary = buildHomeCommandCenter(baseInput);

  assert.equal(summary.takeaways[0].id, "stage");
  assert.match(summary.takeaways[0].detail, /Proposal\/Price Quote holds \$2.2M/);
  assert.equal(summary.takeaways[1].id, "forecast");
  assert.match(summary.takeaways[1].detail, /Next month carries \$2M across 3 opportunities/);
  assert.equal(summary.takeaways[2].id, "aging");
  assert.match(summary.takeaways[2].detail, /Restaurant Refinance is stalled 46 days/);
});
