import assert from "node:assert/strict";
import test from "node:test";

import { buildCasePreview } from "./case-preview";
import type { SFCase } from "./salesforce";

function sfCase(overrides: Partial<SFCase>): SFCase {
  return {
    Id: "case-1",
    CaseNumber: "0001",
    Subject: "Question",
    Status: "New",
    Priority: "Low",
    CreatedDate: "2026-06-01T00:00:00.000Z",
    ClosedDate: null,
    Description: null,
    Contact: null,
    Owner: null,
    ...overrides,
  };
}

test("buildCasePreview returns all cases when count is within the visible limit", () => {
  const preview = buildCasePreview([
    sfCase({ Id: "case-1" }),
    sfCase({ Id: "case-2" }),
  ], 3);

  assert.equal(preview.visibleCases.length, 2);
  assert.equal(preview.hiddenCount, 0);
  assert.equal(preview.hiddenSummary, null);
});

test("buildCasePreview summarizes hidden open and high-priority cases", () => {
  const preview = buildCasePreview([
    sfCase({ Id: "case-1", Status: "New", Priority: "Low" }),
    sfCase({ Id: "case-2", Status: "Working", Priority: "Medium" }),
    sfCase({ Id: "case-3", Status: "Closed", Priority: "Low" }),
    sfCase({ Id: "case-4", Status: "New", Priority: "High" }),
    sfCase({ Id: "case-5", Status: "Escalated", Priority: "High" }),
  ], 3);

  assert.deepEqual(preview.visibleCases.map((item) => item.Id), ["case-1", "case-2", "case-3"]);
  assert.equal(preview.hiddenCount, 2);
  assert.equal(preview.hiddenOpenCount, 2);
  assert.equal(preview.hiddenHighPriorityCount, 2);
  assert.equal(preview.hiddenSummary, "2 more cases not shown - 2 open, 2 high priority.");
});
