import { z } from "zod";
import { sfCreate, sfUpdate, query, type SFQueryRecord } from "../salesforce.js";
import { formatDate } from "../utils/formatting.js";
import { toMcpError } from "../utils/errors.js";

// ── Constants ─────────────────────────────────────────────────────────────

const UPDATE_WHITELIST = new Set(["Account", "Contact", "Opportunity", "Lead", "Case"]);
const CREATE_WHITELIST = new Set(["Account", "Contact", "Opportunity", "Lead", "Case", "Task"]);

// Fields that Salesforce manages — never allowed in writes
const SYSTEM_FIELDS = new Set([
  "Id",
  "CreatedDate",
  "CreatedById",
  "LastModifiedDate",
  "LastModifiedById",
  "SystemModstamp",
  "IsDeleted",
  "LastActivityDate",
  "LastViewedDate",
  "LastReferencedDate",
  "MasterRecordId",
]);

// Salesforce record ID: 15 or 18 alphanumeric characters
const SF_ID_RE = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

function lightningUrl(instanceUrl: string, objectType: string, id: string): string {
  return `${instanceUrl}/lightning/r/${objectType}/${id}/view`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── sf_create_task ────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  account_id: z.string().min(1).describe("Salesforce Account (or any object) ID to link the task to via WhatId"),
  subject: z.string().min(1).max(255).describe("Task subject line"),
  description: z.string().optional().describe("Longer task description or notes"),
  priority: z.enum(["High", "Normal", "Low"]).default("Normal").describe("Task priority"),
  due_date: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD). Defaults to 7 days from today."),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export async function createTask(
  input: CreateTaskInput
): Promise<{ text: string; data: object }> {
  const dueDate = input.due_date ?? defaultDueDate();

  const fields: Record<string, unknown> = {
    WhatId: input.account_id,
    Subject: input.subject,
    Priority: input.priority,
    ActivityDate: dueDate,
    Status: "Not Started",
  };
  if (input.description) fields.Description = input.description;

  try {
    const { id, instanceUrl } = await sfCreate("Task", fields);
    const url = lightningUrl(instanceUrl, "Task", id);

    const data = { id, subject: input.subject, priority: input.priority, dueDate, url };
    const text = [
      "✅ Task created successfully",
      "─".repeat(40),
      `ID:        ${id}`,
      `Subject:   ${input.subject}`,
      `Priority:  ${input.priority}`,
      `Due Date:  ${dueDate}`,
      `URL:       ${url}`,
    ].join("\n");

    return { text, data };
  } catch (err) {
    throw new Error(`sf_create_task failed: ${toMcpError(err)}`);
  }
}

// ── sf_log_activity ───────────────────────────────────────────────────────

export const logActivitySchema = z.object({
  account_id: z.string().min(1).describe("Salesforce Account (or any object) ID to log the activity against"),
  subject: z.string().min(1).max(255).describe("Activity subject"),
  description: z.string().optional().describe("Notes or details about the activity"),
  activity_type: z
    .enum(["Call", "Email", "Meeting"])
    .default("Call")
    .describe("Type of activity completed"),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;

export async function logActivity(
  input: LogActivityInput
): Promise<{ text: string; data: object }> {
  const today = new Date().toISOString().slice(0, 10);

  const fields: Record<string, unknown> = {
    WhatId: input.account_id,
    Subject: input.subject,
    Status: "Completed",
    Type: input.activity_type,
    ActivityDate: today,
  };
  if (input.description) fields.Description = input.description;

  try {
    const { id, instanceUrl } = await sfCreate("Task", fields);
    const url = lightningUrl(instanceUrl, "Task", id);

    const data = { id, subject: input.subject, type: input.activity_type, date: today, url };
    const text = [
      "✅ Activity logged successfully",
      "─".repeat(40),
      `ID:        ${id}`,
      `Subject:   ${input.subject}`,
      `Type:      ${input.activity_type}`,
      `Date:      ${today}`,
      `URL:       ${url}`,
    ].join("\n");

    return { text, data };
  } catch (err) {
    throw new Error(`sf_log_activity failed: ${toMcpError(err)}`);
  }
}

// ── sf_update_record ──────────────────────────────────────────────────────

export const updateRecordSchema = z.object({
  object_type: z
    .string()
    .refine((v) => UPDATE_WHITELIST.has(v), {
      message: `object_type must be one of: ${[...UPDATE_WHITELIST].join(", ")}`,
    })
    .describe("Salesforce object type"),
  record_id: z
    .string()
    .regex(SF_ID_RE, "record_id must be a valid 15 or 18-character Salesforce ID")
    .describe("Salesforce record ID (15 or 18 characters)"),
  fields: z
    .record(z.unknown())
    .refine((f) => Object.keys(f).length > 0, { message: "fields must not be empty" })
    .describe("Key-value pairs of field API names and new values"),
});

export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;

interface GenericRecord extends SFQueryRecord {
  [key: string]: unknown;
}

export async function updateRecord(
  input: UpdateRecordInput
): Promise<{ text: string; data: object }> {
  // Reject system-managed fields
  const blocked = Object.keys(input.fields).filter((f) => SYSTEM_FIELDS.has(f));
  if (blocked.length > 0) {
    throw new Error(`Cannot update system-managed fields: ${blocked.join(", ")}`);
  }

  const safeId = input.record_id.replace(/'/g, "\\'");

  // Validate field names before interpolating into SOQL to prevent injection.
  // Salesforce API names are alphanumeric + underscores, optionally namespace-qualified (Ns__Field__c).
  const SAFE_FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
  const unsafeFields = Object.keys(input.fields).filter((f) => !SAFE_FIELD_RE.test(f));
  if (unsafeFields.length > 0) {
    throw new Error(`Invalid field name(s): ${unsafeFields.join(", ")}`);
  }
  const fieldList = Object.keys(input.fields).join(", ");

  try {
    // Fetch before-values so we can show a diff
    let beforeValues: Record<string, unknown> = {};
    try {
      const rows = await query<GenericRecord>(
        `SELECT ${fieldList} FROM ${input.object_type} WHERE Id = '${safeId}' LIMIT 1`
      );
      if (rows.length > 0) beforeValues = rows[0] as Record<string, unknown>;
    } catch {
      // Before-values are best-effort — don't block the update if the query fails
    }

    const { instanceUrl } = await sfUpdate(input.object_type, input.record_id, input.fields);
    const url = lightningUrl(instanceUrl, input.object_type, input.record_id);

    // Build diff summary
    const diffLines = Object.entries(input.fields).map(([field, newVal]) => {
      const oldVal = beforeValues[field];
      const before = oldVal != null ? String(oldVal) : "(empty)";
      const after = newVal != null ? String(newVal) : "(empty)";
      return `  ${field}: ${before} → ${after}`;
    });

    const data = {
      objectType: input.object_type,
      recordId: input.record_id,
      updatedFields: Object.keys(input.fields),
      url,
    };

    const text = [
      `✅ ${input.object_type} updated successfully`,
      "─".repeat(40),
      `ID:      ${input.record_id}`,
      `Changes:`,
      ...diffLines,
      `URL:     ${url}`,
    ].join("\n");

    return { text, data };
  } catch (err) {
    throw new Error(`sf_update_record failed: ${toMcpError(err)}`);
  }
}

// ── sf_create_record ──────────────────────────────────────────────────────

export const createRecordSchema = z.object({
  object_type: z
    .string()
    .refine((v) => CREATE_WHITELIST.has(v), {
      message: `object_type must be one of: ${[...CREATE_WHITELIST].join(", ")}`,
    })
    .describe("Salesforce object type"),
  fields: z
    .record(z.unknown())
    .refine((f) => Object.keys(f).length > 0, { message: "fields must not be empty" })
    .describe("Key-value pairs of field API names and values for the new record"),
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>;

export async function createRecord(
  input: CreateRecordInput
): Promise<{ text: string; data: object }> {
  // Block system fields in creation too
  const blocked = Object.keys(input.fields).filter((f) => SYSTEM_FIELDS.has(f));
  if (blocked.length > 0) {
    throw new Error(`Cannot set system-managed fields: ${blocked.join(", ")}`);
  }

  try {
    const { id, instanceUrl } = await sfCreate(input.object_type, input.fields as Record<string, unknown>);
    const url = lightningUrl(instanceUrl, input.object_type, id);

    const fieldSummary = Object.entries(input.fields)
      .map(([k, v]) => `  ${k}: ${v != null ? String(v) : "(empty)"}`)
      .join("\n");

    const data = { objectType: input.object_type, id, url };
    const text = [
      `✅ ${input.object_type} created successfully`,
      "─".repeat(40),
      `ID:     ${id}`,
      `Fields:`,
      fieldSummary,
      `URL:    ${url}`,
    ].join("\n");

    return { text, data };
  } catch (err) {
    throw new Error(`sf_create_record failed: ${toMcpError(err)}`);
  }
}
