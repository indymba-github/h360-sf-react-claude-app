import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("FinancialAccountCard badge styles use theme tokens instead of literal hex colors", () => {
  const source = readFileSync(join(process.cwd(), "components/financial/FinancialAccountCard.tsx"), "utf8");

  assert.doesNotMatch(source, /#[0-9A-Fa-f]{6}/);
  assert.match(source, /var\(--color-success\)/);
  assert.match(source, /var\(--color-warning\)/);
  assert.match(source, /var\(--color-accent-text\)/);
});
