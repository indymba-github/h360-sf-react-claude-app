import { z } from "zod";
import { query, type SFQueryRecord } from "../salesforce.js";
import { toMcpError } from "../utils/errors.js";

export const runSoqlSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("A read-only SOQL SELECT query to execute against Salesforce"),
});

export type RunSoqlInput = z.infer<typeof runSoqlSchema>;

// DML keywords that are never allowed, checked as whole words
const DML_PATTERN = /\b(INSERT|UPDATE|DELETE|UPSERT|MERGE)\b/i;

function stripComments(soql: string): string {
  let result = soql.replace(/\/\*[\s\S]*?\*\//g, " ");
  result = result.replace(/--[^\n]*/g, " ");
  return result;
}

// SOQL escapes a literal single-quote as '' — strip literal content before keyword scanning
function stripStringLiterals(soql: string): string {
  return soql.replace(/'(?:[^']|'')*'/g, "''");
}

export function validateSoql(soql: string): { valid: boolean; reason?: string } {
  const stripped = stripStringLiterals(stripComments(soql)).trim();

  // Reject multi-statement queries
  if (stripped.includes(";")) {
    return { valid: false, reason: "Query must not contain semicolons (multi-statement queries are not allowed)" };
  }

  // Must start with SELECT
  if (!/^SELECT\b/i.test(stripped)) {
    return { valid: false, reason: "Only SELECT queries are allowed" };
  }

  // Reject DML keywords anywhere in the query
  const dmlMatch = stripped.match(DML_PATTERN);
  if (dmlMatch) {
    return {
      valid: false,
      reason: `DML keyword "${dmlMatch[0].toUpperCase()}" is not allowed in read-only queries`,
    };
  }

  return { valid: true };
}

export async function runSoql(
  input: RunSoqlInput
): Promise<{ text: string; data: unknown }> {
  const validation = validateSoql(input.query);
  if (!validation.valid) {
    throw new Error(`sf_run_soql rejected: ${validation.reason}`);
  }

  try {
    const records = await query<SFQueryRecord>(input.query);

    // Strip jsforce's internal `attributes` field from each record before returning
    const cleaned = records.map(({ attributes: _a, ...rest }) => rest);

    const count = cleaned.length;
    const text = `Query returned ${count} record(s).\n\`\`\`json\n${JSON.stringify(cleaned, null, 2)}\n\`\`\``;

    return { text, data: cleaned };
  } catch (err) {
    throw new Error(`sf_run_soql failed: ${toMcpError(err)}`);
  }
}
