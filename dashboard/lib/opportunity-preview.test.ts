import assert from "node:assert/strict";
import test from "node:test";

import { buildOpportunityPreview } from "./opportunity-preview";
import type { SFOpportunity } from "./salesforce";

function opportunity(overrides: Partial<SFOpportunity>): SFOpportunity {
  return {
    Id: "opp-1",
    Name: "Deposit Expansion",
    StageName: "Qualification",
    Amount: 100_000,
    CloseDate: "2026-08-22",
    Probability: 20,
    ...overrides,
  };
}

test("buildOpportunityPreview separates open pipeline from closed history", () => {
  const preview = buildOpportunityPreview([
    opportunity({ Id: "open-1", StageName: "Qualification", Amount: 875_000 }),
    opportunity({ Id: "won-1", StageName: "Closed Won", Amount: 500_000 }),
    opportunity({ Id: "lost-1", StageName: "Closed Lost", Amount: 250_000 }),
    opportunity({ Id: "open-2", StageName: "Proposal/Price Quote", Amount: 2_200_000 }),
  ]);

  assert.deepEqual(preview.openOpportunities.map((item) => item.Id), ["open-1", "open-2"]);
  assert.equal(preview.openPipelineTotal, 3_075_000);
  assert.equal(preview.closedCount, 2);
  assert.equal(preview.closedWonCount, 1);
  assert.equal(preview.closedLostCount, 1);
  assert.equal(preview.closedWonTotal, 500_000);
  assert.equal(preview.closedSummary, "2 closed opportunities not shown - 1 won ($500K), 1 lost.");
});

test("buildOpportunityPreview handles accounts with only closed opportunities", () => {
  const preview = buildOpportunityPreview([
    opportunity({ Id: "won-1", StageName: "Closed Won", Amount: 500_000 }),
    opportunity({ Id: "lost-1", StageName: "Closed Lost", Amount: 250_000 }),
  ]);

  assert.deepEqual(preview.openOpportunities, []);
  assert.equal(preview.openPipelineTotal, 0);
  assert.equal(preview.closedSummary, "2 closed opportunities not shown - 1 won ($500K), 1 lost.");
});
