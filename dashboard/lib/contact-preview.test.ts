import assert from "node:assert/strict";
import test from "node:test";

import { buildContactPreview } from "./contact-preview";
import type { SFContact } from "./salesforce";

function contact(overrides: Partial<SFContact>): SFContact {
  return {
    Id: "contact-1",
    Name: "Ada Okonkwo",
    Title: "Primary contact",
    Email: "ada@example.com",
    Phone: "555-0100",
    Department: null,
    ...overrides,
  };
}

test("buildContactPreview summarizes email and phone coverage", () => {
  const preview = buildContactPreview([
    contact({ Id: "contact-1" }),
    contact({ Id: "contact-2", Email: null, Phone: null }),
  ]);

  assert.equal(preview.contactCount, 2);
  assert.equal(preview.emailCoveragePercent, 50);
  assert.equal(preview.phoneCoveragePercent, 50);
  assert.equal(preview.missingEmailCount, 1);
  assert.equal(preview.missingPhoneCount, 1);
  assert.equal(preview.gapSummary, "Coverage gaps: 1 missing email, 1 missing phone.");
});

test("buildContactPreview omits gap summary when contact coverage is complete", () => {
  const preview = buildContactPreview([
    contact({ Id: "contact-1" }),
    contact({ Id: "contact-2", Email: "nnamdi@example.com", Phone: "555-0101" }),
  ]);

  assert.equal(preview.emailCoveragePercent, 100);
  assert.equal(preview.phoneCoveragePercent, 100);
  assert.equal(preview.gapSummary, null);
});

test("buildContactPreview handles no contacts", () => {
  const preview = buildContactPreview([]);

  assert.equal(preview.contactCount, 0);
  assert.equal(preview.emailCoveragePercent, 0);
  assert.equal(preview.phoneCoveragePercent, 0);
  assert.equal(preview.gapSummary, null);
});
