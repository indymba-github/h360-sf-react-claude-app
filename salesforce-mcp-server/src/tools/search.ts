import { z } from "zod";
import { search } from "../salesforce.js";
import { formatList } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

export const searchRecordsSchema = z.object({
  query: z.string().min(1).describe("Full-text search term"),
  objects: z
    .array(z.enum(["Account", "Contact", "Opportunity", "Case"]))
    .optional()
    .describe("Limit search to specific object types (default: all four)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Total records to return across all objects (1-50, default 10)"),
});

export type SearchRecordsInput = z.infer<typeof searchRecordsSchema>;

// Characters that must be escaped in a SOSL search term
const SOSL_ESCAPE_RE = /([?&|!{}[\]()^~*:\\"'+\-])/g;

function escapeSosl(term: string): string {
  return term.replace(SOSL_ESCAPE_RE, "\\$1");
}

const OBJECT_FIELDS: Record<string, string> = {
  Account: "Id, Name, Industry, BillingState",
  Contact: "Id, Name, Title, Email",
  Opportunity: "Id, Name, StageName, Amount",
  Case: "Id, CaseNumber, Subject, Status",
};

function getDisplayName(record: Record<string, unknown>): string {
  if (typeof record["Name"] === "string") return record["Name"];
  if (typeof record["Subject"] === "string") return record["Subject"];
  if (typeof record["CaseNumber"] === "string") return `Case ${record["CaseNumber"]}`;
  return String(record["Id"] ?? "Unknown");
}

function getSnippet(record: Record<string, unknown>, objectType: string): string {
  switch (objectType) {
    case "Account":
      return [record["Industry"], record["BillingState"]]
        .filter(Boolean)
        .join(" · ") || "—";
    case "Contact":
      return [record["Title"], record["Email"]]
        .filter(Boolean)
        .join(" · ") || "—";
    case "Opportunity":
      return [
        record["StageName"],
        typeof record["Amount"] === "number"
          ? `$${Number(record["Amount"]).toLocaleString()}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "—";
    case "Case":
      return String(record["Status"] ?? "—");
    default:
      return "—";
  }
}

export interface SearchResult {
  id: string;
  objectType: string;
  name: string;
  snippet: string;
}

export async function searchRecords(
  input: SearchRecordsInput
): Promise<{ text: string; data: SearchResult[] }> {
  const targets = input.objects ?? ["Account", "Contact", "Opportunity", "Case"];
  const returning = targets
    .map((obj) => `${obj}(${OBJECT_FIELDS[obj]})`)
    .join(", ");

  const escapedTerm = escapeSosl(input.query);
  const sosl = `FIND {${escapedTerm}} IN ALL FIELDS RETURNING ${returning} LIMIT ${input.limit}`;

  try {
    const raw = await search(sosl);

    const results: SearchResult[] = raw.map((r) => {
      const rec = r as Record<string, unknown>;
      const objectType = (rec["attributes"] as { type: string } | undefined)?.type ?? "Unknown";
      return {
        id: String(rec["Id"] ?? ""),
        objectType,
        name: getDisplayName(rec),
        snippet: getSnippet(rec, objectType),
      };
    });

    const header = `Found ${results.length} result(s) for "${input.query}":\n${"─".repeat(40)}`;
    const body = formatList(results, (r, i) => {
      return [
        `${i + 1}. [${r.objectType}] ${r.name}`,
        `   ID:      ${r.id}`,
        `   Detail:  ${r.snippet}`,
      ].join("\n");
    });

    return { text: `${header}\n\n${body}`, data: results };
  } catch (err) {
    throw new Error(`sf_search_records failed: ${toMcpError(err)}`);
  }
}
