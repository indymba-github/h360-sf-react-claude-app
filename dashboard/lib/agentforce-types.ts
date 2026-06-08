import type { RenderDirective } from './render-directives'

export type AgentforceMessageType =
  | "Inform"
  | "Inquire"
  | "Confirm"
  | "EscalateToHuman"
  | string;

export interface AgentforceRecordChoice {
  id: string;
  title: string;
  type?: string;
  subtitle?: string;
  fields?: Record<string, string>;
}

export interface AgentforceResultRecord {
  id: string;
  title: string;
  subtitle?: string;
  objectType?: string;
  fields: Record<string, string>;
}

export interface AgentforceResultGroup {
  objectType: string;
  label: string;
  records: AgentforceResultRecord[];
}

interface CollectRecord {
  id: string;
  sObjectInfo?: { apiName: string; label: string };
  title: string;
  data?: Record<string, { displayValue: string | null; value: unknown }>;
}

interface CollectItem {
  targetType: string;
  targetProperty: string;
  data: {
    type: string;
    value: CollectRecord[];
    property: string;
  };
}

interface ResultRecord {
  id: string;
  sObjectInfo?: { apiName: string; label: string };
  recordTypeId?: string;
  title: string;
  data?: Record<string, { displayValue: string | null; value: unknown }>;
}

interface ResultItem {
  type: string;
  value: {
    result?: ResultRecord[] | string;
    IntegrationProcedureOutput?: Record<string, unknown>;
    promptResponse?: string;
  };
  property: string;
}

export interface AgentforceAggregateSummary {
  actionType: string;
  html: string;
}

export interface AgentforceRawMessage {
  type: AgentforceMessageType;
  message: string;
  collect?: CollectItem[];
  result?: ResultItem[];
  id?: string;
  feedbackId?: string;
  isContentSafe?: boolean;
  metrics?: Record<string, unknown>;
  planId?: string;
}

export interface AgentforceNormalizedResponse {
  text: string;
  type: AgentforceMessageType;
  choices?: AgentforceRecordChoice[];
  results?: AgentforceResultGroup[];
  summaries?: AgentforceAggregateSummary[];
  render?: RenderDirective | null;
}

function extractDisplayFields(
  data?: Record<string, { displayValue: string | null; value: unknown }>
): Record<string, string> {
  if (!data) return {};
  const fields: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    const display = val.displayValue ?? val.value;
    if (typeof display === "string" && display.trim().length > 0) {
      fields[key] = display;
    }
  }
  return fields;
}

function pluralize(type: string, count: number): string {
  if (count === 1) return type;
  if (type.endsWith("s")) return type;
  if (type.endsWith("y")) return type.slice(0, -1) + "ies";
  return type + "s";
}

const IP_STRIP_FIELDS = new Set([
  "role", "isheldaway", "sourcesystemidentifier",
]);

function ipRecordToResult(
  obj: Record<string, unknown>,
  groupLabel: string
): AgentforceResultRecord {
  const fields: Record<string, string> = {};
  const idKey = Object.keys(obj).find((k) =>
    k.toLowerCase().endsWith("id") && !k.endsWith("_set") && typeof obj[k] === "string"
  );
  const id = idKey ? (obj[idKey] as string) : "";

  const nameKey =
    Object.keys(obj).find((k) =>
      k.toLowerCase().includes("name") && !k.endsWith("_set") && typeof obj[k] === "string"
    ) ??
    Object.keys(obj).find((k) =>
      k.toLowerCase().includes("number") && !k.endsWith("_set") && typeof obj[k] === "string"
    );
  const title = nameKey ? (obj[nameKey] as string) : groupLabel;

  // FinancialAccountType becomes subtitle, rendered alongside account number
  const typeKey = Object.keys(obj).find((k) =>
    k.toLowerCase() === "financialaccounttype" && typeof obj[k] === "string"
  );
  const subtitle = typeKey ? (obj[typeKey] as string) : undefined;

  for (const [key, val] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (key.endsWith("_set")) continue;
    if (key.toLowerCase() === idKey?.toLowerCase()) continue;
    if (IP_STRIP_FIELDS.has(lk)) continue;
    if (typeKey && lk === typeKey.toLowerCase()) continue;
    if (typeof val === "string" && val.trim().length > 0) {
      fields[key] = val;
    } else if (typeof val === "boolean") {
      fields[key] = val ? "Yes" : "No";
    } else if (typeof val === "number") {
      fields[key] = String(val);
    }
  }

  return { id, title, subtitle, objectType: groupLabel, fields };
}

function extractIntegrationProcedureRecords(
  output: Record<string, unknown>,
  resultsByType: Map<string, AgentforceResultRecord[]>
): void {
  for (const [key, val] of Object.entries(output)) {
    if (key.endsWith("_set") || key === "error" || key === "error_set") continue;
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
      const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
      if (!resultsByType.has(label)) resultsByType.set(label, []);
      for (const item of val) {
        resultsByType.get(label)!.push(
          ipRecordToResult(item as Record<string, unknown>, label)
        );
      }
    }
  }
}

export function parseAgentforceResponse(
  data: { messages?: AgentforceRawMessage[] }
): AgentforceNormalizedResponse {
  const msg = data.messages?.[0];
  if (!msg) return { text: "", type: "Inform" };

  const choices: AgentforceRecordChoice[] = [];

  if (msg.collect && Array.isArray(msg.collect)) {
    for (const item of msg.collect) {
      const records = item.data?.value;
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        const typeField = record.data?.Type;
        const rawSubtitle = typeField?.displayValue ?? typeField?.value;
        const subtitle = typeof rawSubtitle === "string" ? rawSubtitle : undefined;
        choices.push({
          id: record.id,
          title: record.title,
          type: record.sObjectInfo?.label,
          subtitle,
          fields: extractDisplayFields(record.data),
        });
      }
    }
  }

  const resultsByType = new Map<string, AgentforceResultRecord[]>();
  const summaries: AgentforceAggregateSummary[] = [];

  if (msg.result && Array.isArray(msg.result)) {
    for (const item of msg.result) {
      const records = item.value?.result;
      if (Array.isArray(records)) {
        for (const record of records) {
          const objectType = record.sObjectInfo?.label || "Record";
          if (!resultsByType.has(objectType)) {
            resultsByType.set(objectType, []);
          }
          resultsByType.get(objectType)!.push({
            id: record.id,
            title: record.title,
            objectType,
            fields: extractDisplayFields(record.data),
          });
        }
      } else if (typeof records === "string" && records.trim().length > 0) {
        summaries.push({ actionType: item.type, html: records });
      } else if (typeof item.value?.promptResponse === "string" && item.value.promptResponse.trim().length > 0) {
        summaries.push({ actionType: item.type, html: item.value.promptResponse });
      } else if (item.value?.IntegrationProcedureOutput) {
        extractIntegrationProcedureRecords(item.value.IntegrationProcedureOutput, resultsByType);
      }
    }
  }

  const results: AgentforceResultGroup[] = [];
  for (const [objectType, records] of resultsByType.entries()) {
    results.push({
      objectType,
      label: pluralize(objectType, records.length),
      records,
    });
  }

  return {
    text: msg.message ?? "",
    type: msg.type ?? "Inform",
    choices: choices.length > 0 ? choices : undefined,
    results: results.length > 0 ? results : undefined,
    summaries: summaries.length > 0 ? summaries : undefined,
  };
}
