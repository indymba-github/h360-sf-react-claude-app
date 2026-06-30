import assert from "node:assert/strict";
import test from "node:test";

import { formatDate } from "./format";

test("formatDate preserves Salesforce date-only values", () => {
  assert.equal(formatDate("2026-08-22"), "Aug 22, 2026");
});

test("formatDate formats date-time values through local time", () => {
  assert.equal(formatDate("2026-08-22T16:30:00.000Z"), "Aug 22, 2026");
});

test("formatDate returns an em dash for missing values", () => {
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate(undefined), "—");
});

test("formatDate returns malformed values unchanged", () => {
  assert.equal(formatDate("not-a-date"), "not-a-date");
});
