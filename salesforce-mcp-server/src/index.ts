import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { listAccounts, listAccountsSchema, getAccount, getAccountSchema } from "./tools/accounts.js";
import { searchRecords, searchRecordsSchema } from "./tools/search.js";
import { getOpportunities, getOpportunitiesSchema } from "./tools/opportunities.js";
import { getContacts, getContactsSchema } from "./tools/contacts.js";
import { getCases, getCasesSchema } from "./tools/cases.js";
import { getPipelineSummary, getPipelineSummarySchema, getRecentActivity, getRecentActivitySchema } from "./tools/analytics.js";
import { runSoql, runSoqlSchema } from "./tools/soql.js";
import {
  createTask, createTaskSchema,
  logActivity, logActivitySchema,
  updateRecord, updateRecordSchema,
  createRecord, createRecordSchema,
} from "./tools/write.js";
import {
  getFinancialAccounts, getFinancialAccountsSchema,
  getFinancialHoldings, getFinancialHoldingsSchema,
  getAssetsLiabilities, getAssetsLiabilitiesSchema,
  getClientSummary, getClientSummarySchema,
  getFinancialAccountRoles, getFinancialAccountRolesSchema,
  getAccountRelationships, getAccountRelationshipsSchema,
} from "./tools/financial.js";
import { toMcpError } from "./utils/errors.js";
import { RESOURCES, readResource } from "./resources.js";
import { PROMPTS, getPrompt } from "./prompts.js";
import { getNewsAlerts as mcpGetNewsAlerts, getNewsAlertsSchema, getTasks, getTasksSchema } from "./tools/tasks.js";
import { createMortgageOpportunityTool, executeCreateMortgageOpportunity } from "./tools/opportunity-write.js";

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const WRITE_OP: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

const server = new Server(
  { name: "salesforce-mcp-server", version: "0.2.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// ── Tool registry ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "sf_list_accounts",
    description: "List Salesforce accounts with optional filters for industry and rating",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        industry: { type: "string", description: "Filter by Industry (e.g. 'Technology')" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Records to return (1-50)" },
      },
      required: [],
    },
  },
  {
    name: "sf_get_account",
    description: "Get full details for a single Salesforce account by ID",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce Account ID (15 or 18 characters)" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "sf_search_records",
    description: "Full-text search across Account, Contact, Opportunity, and Case using SOSL",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Full-text search term" },
        objects: {
          type: "array",
          items: { type: "string", enum: ["Account", "Contact", "Opportunity", "Case"] },
          description: "Limit search to specific object types (default: all four)",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Total records to return" },
      },
      required: ["query"],
    },
  },
  {
    name: "sf_get_opportunities",
    description: "Get opportunities for an account or list all opportunities with optional stage filter",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Filter by Account ID" },
        stage: { type: "string", description: "Filter by StageName (e.g. 'Closed Won', 'Prospecting')" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Records to return (1-50)" },
      },
      required: [],
    },
  },
  {
    name: "sf_get_contacts",
    description: "Get contacts for an account or list all contacts",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Filter by Account ID" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Records to return (1-50)" },
      },
      required: [],
    },
  },
  {
    name: "sf_get_cases",
    description: "Get cases for an account or list recent cases with optional status filter",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Filter by Account ID" },
        status: { type: "string", description: "Filter by Status (e.g. 'Open', 'Closed', 'Escalated')" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Records to return (1-50)" },
      },
      required: [],
    },
  },
  {
    name: "sf_get_pipeline_summary",
    description: "Aggregate open opportunities by stage, including total pipeline value and historical win rate",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "sf_get_recent_activity",
    description: "Most recently modified records across Account, Contact, Opportunity, and Case",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Total records to return (1-50)" },
      },
      required: [],
    },
  },
  {
    name: "sf_run_soql",
    description: "Execute a read-only SOQL SELECT query. DML statements (INSERT, UPDATE, DELETE, UPSERT, MERGE) are rejected.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "A SOQL SELECT query to execute" },
      },
      required: ["query"],
    },
  },
  {
    name: "sf_get_financial_accounts",
    description: "Get financial accounts for a client. Returns banking, investment, loan, and insurance accounts.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce Account ID of the primary owner. If omitted, returns all." },
        account_type: { type: "string", description: "Filter by financial account type (e.g. 'Checking', 'Savings', 'Investment', 'Loan')" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20, description: "Records to return (1-50, default 20)" },
      },
      required: [],
    },
  },
  {
    name: "sf_get_financial_holdings",
    description: "Get investment holdings within a financial account. Shows securities, shares, market value, and gain/loss.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        financial_account_id: { type: "string", description: "Financial Account record ID" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20, description: "Records to return (1-50, default 20)" },
      },
      required: ["financial_account_id"],
    },
  },
  {
    name: "sf_get_assets_liabilities",
    description: "Get a client's assets and liabilities for net worth analysis. Includes real estate, vehicles, debts, and other assets.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce Account ID of the primary owner" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20, description: "Records to return (1-50, default 20)" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "sf_get_client_summary",
    description: "Get a comprehensive financial summary for a client. Aggregates financial accounts by type, calculates total balances, and provides a net worth snapshot. Use this when someone asks for an overview of a client's financial position.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce Account ID" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "sf_get_financial_account_roles",
    description: "Get the roles and relationships associated with a financial account. Shows joint owners, beneficiaries, authorized signers, etc.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        financial_account_id: { type: "string", description: "Financial Account record ID" },
      },
      required: ["financial_account_id"],
    },
  },
  {
    name: "sf_get_account_relationships",
    description: "Get household and account-to-account relationships. Shows how accounts are connected, such as household members, business partners, etc.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce Account ID" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "sf_create_task",
    description:
      "Create a follow-up task linked to a Salesforce record. " +
      "Always describe the task to the user and get explicit confirmation before calling this tool.",
    annotations: WRITE_OP,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce record ID to link the task to (WhatId)" },
        subject: { type: "string", description: "Task subject line (max 255 characters)" },
        description: { type: "string", description: "Optional task notes or description" },
        priority: { type: "string", enum: ["High", "Normal", "Low"], description: "Task priority (default: Normal)" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format (default: 7 days from today)" },
      },
      required: ["account_id", "subject"],
    },
  },
  {
    name: "sf_log_activity",
    description:
      "Log a completed activity (call, email, or meeting) on a Salesforce record. " +
      "Always confirm the details with the user before calling this tool.",
    annotations: WRITE_OP,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Salesforce record ID to log the activity against" },
        subject: { type: "string", description: "Activity subject (max 255 characters)" },
        description: { type: "string", description: "Optional notes or details about the activity" },
        activity_type: { type: "string", enum: ["Call", "Email", "Meeting"], description: "Type of activity (default: Call)" },
      },
      required: ["account_id", "subject"],
    },
  },
  {
    name: "sf_update_record",
    description:
      "Update one or more fields on a standard Salesforce object. " +
      "Always show the user exactly what will change and get explicit confirmation before calling this tool.",
    annotations: WRITE_OP,
    inputSchema: {
      type: "object" as const,
      properties: {
        object_type: {
          type: "string",
          enum: ["Account", "Contact", "Opportunity", "Lead", "Case"],
          description: "Salesforce object type",
        },
        record_id: { type: "string", description: "Salesforce record ID (15 or 18 characters)" },
        fields: {
          type: "object",
          description: "Key-value pairs of field API names and their new values",
          additionalProperties: true,
        },
      },
      required: ["object_type", "record_id", "fields"],
    },
  },
  {
    name: "sf_create_record",
    description:
      "Create a new record on a standard Salesforce object. " +
      "Always show the user exactly what will be created and get explicit confirmation before calling this tool.",
    annotations: WRITE_OP,
    inputSchema: {
      type: "object" as const,
      properties: {
        object_type: {
          type: "string",
          enum: ["Account", "Contact", "Opportunity", "Lead", "Case", "Task"],
          description: "Salesforce object type",
        },
        fields: {
          type: "object",
          description: "Key-value pairs of field API names and values for the new record",
          additionalProperties: true,
        },
      },
      required: ["object_type", "fields"],
    },
  },
  {
    name: "sf_get_news_alerts",
    description:
      "Get news alerts generated by the monitoring agent. These are tasks with subjects starting with 'News Alert:' that contain banker summaries about client companies. Each alert includes a detailed description with banking opportunities identified from recent news.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Filter alerts by Account ID" },
        limit:      { type: "number", description: "Number of records to return (1-50, default 10)" },
      },
    },
  },
  {
    name: "sf_get_tasks",
    description:
      "Get tasks for an account or the current user. Excludes news alerts (use sf_get_news_alerts for those).",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Filter tasks by Account ID" },
        status:     { type: "string", description: "Filter by Status (e.g. 'Not Started', 'In Progress', 'Completed')" },
        limit:      { type: "number", description: "Number of records to return (1-50, default 10)" },
      },
    },
  },
  createMortgageOpportunityTool,
];

// ── Handler: list tools ────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContent(text: string, data: unknown) {
  return [
    { type: "text" as const, text },
    { type: "text" as const, text: "```json\n" + JSON.stringify(data, null, 2) + "\n```" },
  ];
}

function zodError(name: string, err: z.ZodError) {
  return {
    content: [{ type: "text" as const, text: `Invalid input for ${name}: ${err.errors.map((e) => e.message).join(", ")}` }],
    isError: true,
  };
}

function toolError(err: unknown) {
  return {
    content: [{ type: "text" as const, text: toMcpError(err) }],
    isError: true,
  };
}

// ── Handler: call tool ─────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "sf_list_accounts": {
        const input = listAccountsSchema.parse(args ?? {});
        const { text, data } = await listAccounts(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_account": {
        const input = getAccountSchema.parse(args ?? {});
        const { text, data } = await getAccount(input);
        return { content: makeContent(text, data) };
      }

      case "sf_search_records": {
        const input = searchRecordsSchema.parse(args ?? {});
        const { text, data } = await searchRecords(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_opportunities": {
        const input = getOpportunitiesSchema.parse(args ?? {});
        const { text, data } = await getOpportunities(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_contacts": {
        const input = getContactsSchema.parse(args ?? {});
        const { text, data } = await getContacts(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_cases": {
        const input = getCasesSchema.parse(args ?? {});
        const { text, data } = await getCases(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_pipeline_summary": {
        const input = getPipelineSummarySchema.parse(args ?? {});
        const { text, data } = await getPipelineSummary(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_recent_activity": {
        const input = getRecentActivitySchema.parse(args ?? {});
        const { text, data } = await getRecentActivity(input);
        return { content: makeContent(text, data) };
      }

      case "sf_run_soql": {
        const input = runSoqlSchema.parse(args ?? {});
        const { text, data } = await runSoql(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_financial_accounts": {
        const input = getFinancialAccountsSchema.parse(args ?? {});
        const { text, data } = await getFinancialAccounts(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_financial_holdings": {
        const input = getFinancialHoldingsSchema.parse(args ?? {});
        const { text, data } = await getFinancialHoldings(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_assets_liabilities": {
        const input = getAssetsLiabilitiesSchema.parse(args ?? {});
        const { text, data } = await getAssetsLiabilities(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_client_summary": {
        const input = getClientSummarySchema.parse(args ?? {});
        const { text, data } = await getClientSummary(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_financial_account_roles": {
        const input = getFinancialAccountRolesSchema.parse(args ?? {});
        const { text, data } = await getFinancialAccountRoles(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_account_relationships": {
        const input = getAccountRelationshipsSchema.parse(args ?? {});
        const { text, data } = await getAccountRelationships(input);
        return { content: makeContent(text, data) };
      }

      case "sf_create_task": {
        const input = createTaskSchema.parse(args ?? {});
        const { text, data } = await createTask(input);
        return { content: makeContent(text, data) };
      }

      case "sf_log_activity": {
        const input = logActivitySchema.parse(args ?? {});
        const { text, data } = await logActivity(input);
        return { content: makeContent(text, data) };
      }

      case "sf_update_record": {
        const input = updateRecordSchema.parse(args ?? {});
        const { text, data } = await updateRecord(input);
        return { content: makeContent(text, data) };
      }

      case "sf_create_record": {
        const input = createRecordSchema.parse(args ?? {});
        const { text, data } = await createRecord(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_news_alerts": {
        const input = getNewsAlertsSchema.parse(args ?? {});
        const { text, data } = await mcpGetNewsAlerts(input);
        return { content: makeContent(text, data) };
      }

      case "sf_get_tasks": {
        const input = getTasksSchema.parse(args ?? {});
        const { text, data } = await getTasks(input);
        return { content: makeContent(text, data) };
      }

      case "create_mortgage_opportunity": {
        return await executeCreateMortgageOpportunity(
          (args ?? {}) as Parameters<typeof executeCreateMortgageOpportunity>[0]
        );
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    if (err instanceof z.ZodError) return zodError(name, err);
    return toolError(err);
  }
});

// ── Handler: list prompts ──────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS,
}));

// ── Handler: get prompt ────────────────────────────────────────────────────

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return getPrompt(name, (args ?? {}) as Record<string, string>);
  } catch (err) {
    throw new Error(toMcpError(err));
  }
});

// ── Handler: list resource templates ──────────────────────────────────────

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [],
}));

// ── Handler: list resources ────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: RESOURCES,
}));

// ── Handler: read resource ─────────────────────────────────────────────────

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  try {
    const text = await readResource(uri);
    return {
      contents: [{ uri, mimeType: "application/json", text }],
    };
  } catch (err) {
    throw new Error(toMcpError(err));
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
