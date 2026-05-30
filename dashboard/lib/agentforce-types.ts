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
    result: ResultRecord[] | string;
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
