import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool, Prompt } from "@modelcontextprotocol/sdk/types.js";
import { getSession } from "@/lib/session";
import { getEffectiveMcpMode, localMcpServerPath, hostedMcpServerUrl } from "@/lib/mcp-config";
import type { McpMode } from "@/lib/mcp-config";
import { refreshSession, refreshMcpSession, PROACTIVE_REFRESH_THRESHOLD_MS } from "@/lib/token-refresh";
import { hasRenderDirective, type RenderDirective } from "@/lib/render-directives";
import { RENDER_TOOLS, RENDER_TOOL_NAMES, handleRenderTool } from "@/lib/render-tools";
import { PIPELINE_HEURISTICS, heuristicsToPromptText } from "@/lib/risk-heuristics";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TOOL_ITERATIONS = 15;

/** Normalize tools from either MCP server variant into Anthropic's format. */
function normalizeTools(mcpTools: Tool[]): Anthropic.Tool[] {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? `Tool: ${t.name}`,
    input_schema: (t.inputSchema ?? {
      type: "object",
      properties: {},
      required: [],
    }) as Anthropic.Tool["input_schema"],
  }));
}

/** Convert MCP prompt templates into Anthropic tool definitions (hosted mode only). */
function normalizePrompts(prompts: Prompt[]): Anthropic.Tool[] {
  return prompts.map((p) => {
    const args = p.arguments ?? [];
    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];
    for (const arg of args) {
      properties[arg.name] = { type: "string", ...(arg.description ? { description: arg.description } : {}) };
      if (arg.required) required.push(arg.name);
    }
    return {
      name: p.name,
      description: p.description ?? `Prompt: ${p.name}`,
      input_schema: {
        type: "object" as const,
        properties,
        ...(required.length > 0 ? { required } : {}),
      } as Anthropic.Tool["input_schema"],
    };
  });
}

const PROP_NAME_RE = /^[a-zA-Z0-9_.-]{1,64}$/;

/** Sanitize tool input_schema property names to match Anthropic's requirements. */
function sanitizeToolPropertyNames(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  return tools.map((tool) => {
    const schema = tool.input_schema as {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    const props = schema.properties;
    if (!props || Object.keys(props).length === 0) return tool;

    const renames = new Map<string, string>();
    const sanitizedProps: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(props)) {
      if (PROP_NAME_RE.test(key)) {
        sanitizedProps[key] = value;
        continue;
      }
      const cleaned = key.replace(/ /g, "_").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64);
      // Guard against a name that becomes empty after stripping (e.g. all special chars)
      const safe = cleaned || `prop_${Object.keys(sanitizedProps).length}`;
      renames.set(key, safe);
      sanitizedProps[safe] = value;
    }

    if (renames.size === 0) return tool;

    console.warn(`[tool:${tool.name}] sanitized property name(s):`, Object.fromEntries(renames));

    const newRequired = schema.required?.map((r) => renames.get(r) ?? r);

    return {
      ...tool,
      input_schema: {
        ...schema,
        properties: sanitizedProps,
        ...(newRequired !== undefined ? { required: newRequired } : {}),
      } as Anthropic.Tool["input_schema"],
    };
  });
}

// ── Hosted MCP tool deduplication ────────────────────────────────────────
//
// The hosted server exposes 40+ tools where many share a base name but differ
// only by a permission-scope suffix: _reads, _all, _mutations, _deletes.
// Sending all variants wastes context and pushes Claude toward the tool-call
// limit. We keep one variant per base name, preferring _all > _reads > _mutations.

const SCOPE_SUFFIX_RE = /_(reads|all|mutations|deletes)$/;
const SCOPE_PRIORITY: Record<string, number> = { all: 3, reads: 2, mutations: 1, deletes: 0 };

function deduplicateHostedTools(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  const best = new Map<string, { tool: Anthropic.Tool; priority: number }>();

  for (const tool of tools) {
    const m = tool.name.match(SCOPE_SUFFIX_RE);
    if (!m) {
      // No recognized suffix — keep as-is (won't collide with scoped variants)
      if (!best.has(tool.name)) best.set(tool.name, { tool, priority: -1 });
      continue;
    }
    const base = tool.name.slice(0, -m[0].length);
    const priority = SCOPE_PRIORITY[m[1]] ?? 0;
    const existing = best.get(base);
    if (!existing || priority > existing.priority) {
      best.set(base, { tool, priority });
    }
  }

  const deduped = [...best.values()].map(({ tool }) => tool);
  return deduped;
}

// ── Resource context injection (local mode) ───────────────────────────────

const RESOURCE_SECTION_TITLES: Record<string, string> = {
  "salesforce://user/profile":               "USER PROFILE",
  "salesforce://schema/objects":             "AVAILABLE OBJECTS",
  "salesforce://picklists/opportunity-stages": "OPPORTUNITY STAGES",
  "salesforce://picklists/industries":       "INDUSTRY VALUES",
};

// Objects schema is too large to inject into every system prompt (~150k tokens).
// It remains available as an MCP resource for on-demand reads, but is excluded here.
const SKIP_IN_SYSTEM_PROMPT = new Set(["salesforce://schema/objects"]);

// Per-user resource context cache — avoids 3 SF API calls on every turn.
// Keyed by userId:instanceUrl so each user gets their own profile, not another org member's.
// TTL of 5 minutes covers a typical session without serving stale picklists.
const RESOURCE_CACHE = new Map<string, { context: string; fetchedAt: number }>();
const RESOURCE_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchResourceContext(client: Client, cacheKey: string): Promise<string> {
  const cached = RESOURCE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < RESOURCE_CACHE_TTL_MS) {
    return cached.context;
  }

  try {
    const { resources } = await client.listResources();

    if (!resources.length) return "";

    const sections: string[] = [];
    for (const resource of resources) {
      if (SKIP_IN_SYSTEM_PROMPT.has(resource.uri)) continue;
      try {
        const { contents } = await client.readResource({ uri: resource.uri });
        const first = contents[0];
        const text = first && "text" in first ? first.text : undefined;
        if (!text) continue;
        const title = RESOURCE_SECTION_TITLES[resource.uri] ?? resource.name ?? resource.uri;

        sections.push(`${title}:\n${text}`);
      } catch {
        // Non-fatal — skip individual resources that fail to load
      }
    }

    if (!sections.length) return "";
    const context =
      "You have the following context from Salesforce:\n\n" +
      sections.join("\n\n") +
      "\n\nUse this context to inform your responses. " +
      "Use the correct stage names and industry values in queries and filters.";

    RESOURCE_CACHE.set(cacheKey, { context, fetchedAt: Date.now() });
    return context;
  } catch {
    return "";
  }
}

const BASE_SYSTEM_PROMPT =
  "You are an AI assistant for relationship managers at a bank. " +
  "You have access to the full Salesforce CRM via tools. " +
  "Use the tools to look up real data before answering. " +
  "Be concise and specific.\n\n" +
  "You also have tools to create and update Salesforce records. " +
  "IMPORTANT RULES for write operations:\n" +
  "1. ALWAYS describe exactly what you plan to create or change BEFORE calling any write tool.\n" +
  "2. ALWAYS wait for explicit user confirmation ('yes', 'go ahead', 'do it', 'confirm') before executing the write.\n" +
  "3. NEVER batch multiple writes without confirming each one individually.\n" +
  "4. After a successful write, link to the created or updated record (see LINKING TO RECORDS below).\n" +
  "5. If the user says 'no' or 'cancel', acknowledge and do not call the tool.\n\n" +
  "You can suggest write actions proactively when analysis reveals action items — for example, " +
  "after reviewing an account you might say 'I notice there are no follow-up tasks scheduled. " +
  "Would you like me to create one?'\n\n" +
  "FOLLOW-UP QUESTIONS: At the end of EVERY response, append a fenced code block with 2-3 short " +
  "follow-up questions the user might naturally ask next. Format exactly like this:\n" +
  "```follow-ups\n" +
  "What are the key contacts?\n" +
  "Are there any open cases?\n" +
  "Show me recent activity\n" +
  "```\n" +
  "The questions should be concise (under 8 words each), specific to the current context, and " +
  "phrased as natural follow-ons to what you just said. Do not add this block if the response is " +
  "a write proposal (asking for confirmation before a write operation).\n\n" +
  "MORTGAGE CALCULATOR:\n" +
  "You have a render tool called render_mortgage_calculator that " +
  "opens an interactive mortgage payment calculator as an overlay " +
  "on the user's screen. Use it when:\n" +
  "- The user asks to calculate, estimate, or compute a mortgage payment\n" +
  "- The user asks 'what would X cost monthly?' or similar hypothetical mortgage questions\n" +
  "- The user mentions specific mortgage parameters and you can extract values\n" +
  "- The user wants to explore mortgage scenarios\n\n" +
  "VALUE EXTRACTION:\n" +
  "- '$500K home' → homePrice: 500000\n" +
  "- '20% down' → downPaymentPercent: 20\n" +
  "'$100,000 down' → downPaymentAmount: 100000\n" +
  "- '7.5% rate' → interestRate: 7.5\n" +
  "- '30-year mortgage' → loanTermYears: 30\n" +
  "- '$500/month HOA' → monthlyHOA: 500\n\n" +
  "For any value the user does NOT specify, omit it from the tool call. " +
  "DO NOT ASK the user for missing values before calling the tool — just call it with what you have. " +
  "After the calculator renders, you may comment briefly on the scenario but don't need to recompute.\n\n" +
  "CREATING OPPORTUNITIES FROM THE CALCULATOR:\n" +
  "You have a tool called create_mortgage_opportunity that creates a real Salesforce Opportunity " +
  "from a mortgage scenario. This is a WRITE operation that permanently creates a record.\n\n" +
  "MANDATORY CONFIRMATION FLOW:\n" +
  "When the user asks to create an opportunity from a mortgage scenario " +
  "(often triggered by a 'Create Opportunity' button that sends you the scenario details):\n" +
  "1. DO NOT call create_mortgage_opportunity immediately.\n" +
  "2. FIRST, describe the opportunity you propose to create:\n" +
  "   - The auto-generated name (Mortgage — [Account] — [date])\n" +
  "   - The Amount (the loan principal)\n" +
  "   - Stage (Prospecting) and Close Date (30 days out)\n" +
  "   - A note that the full scenario goes in the description\n" +
  "3. ASK the user to confirm (e.g., 'Shall I create this opportunity?').\n" +
  "4. ONLY after the user confirms ('yes', 'go ahead', 'create it', etc.) " +
  "call create_mortgage_opportunity with the scenario values.\n" +
  "5. After creation, confirm success and share the record details.\n\n" +
  "If you don't have an accountId, ask the user which account the opportunity should belong to " +
  "before proposing anything.\n\n" +
  "This confirmation step is REQUIRED for all write operations. " +
  "Never create, update, or delete Salesforce records without explicit user confirmation in the conversation.";

const HOSTED_PROMPT_ADDENDUM =
  "\n\nYou have access to pre-built Salesforce prompt templates. " +
  "Use the correct template for each request:\n\n" +
  "- For account briefings, account reviews, meeting prep, or account summaries: use einstein_gpt__accountReviewBriefing\n" +
  "- For revenue reconciliation or financial analysis: use einstein_gpt__revenueReconciliationAnalysis\n\n" +
  "Do NOT use revenue reconciliation for meeting prep or account reviews. " +
  "After calling a prompt template, present the result directly. " +
  "Only make additional individual tool calls if the user asks a specific follow-up question that the template result didn't answer.";

interface AccountContext {
  accountId: string;
  accountName: string;
  industry?: string | null;
  annualRevenue?: number | null;
  type?: string | null;
}

function buildAccountContextBlock(ctx: AccountContext): string {
  const details: string[] = [];
  if (ctx.type)          details.push(`Type: ${ctx.type}`);
  if (ctx.industry)      details.push(`Industry: ${ctx.industry}`);
  if (ctx.annualRevenue) details.push(`Annual Revenue: $${ctx.annualRevenue.toLocaleString()}`);
  const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";
  return (
    `You are currently scoped to ${ctx.accountName}${detailStr} (Account ID: ${ctx.accountId}). ` +
    `When the user uses pronouns like "her", "his", "their", uses a first name only, or says ` +
    `"this account" or "this client", they are referring to ${ctx.accountName}. ` +
    `Use account_id ${ctx.accountId} for these queries without asking for clarification.\n\n` +
    `However, if the user explicitly names a different account, asks about the overall pipeline, ` +
    `or asks a question that is clearly not about ${ctx.accountName}, respond to that question ` +
    `normally using the appropriate tools. The account context is a default, not a constraint.`
  );
}

function buildSystemPrompt(mode: McpMode, resourceContext = "", accountContext?: AccountContext, instanceUrl?: string): string {
  const base = mode === "hosted" ? BASE_SYSTEM_PROMPT + HOSTED_PROMPT_ADDENDUM : BASE_SYSTEM_PROMPT;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const parts: string[] = [
    `Today's date is ${dateStr}. The current day of the week is ${weekday}.`,
  ];
  if (accountContext) parts.push(buildAccountContextBlock(accountContext));
  parts.push(base);
  if (instanceUrl) {
    const baseUrl = instanceUrl.replace(/\/$/, "");
    parts.push(
      "LINKING TO RECORDS:\n" +
      `The Salesforce org URL is ${baseUrl}. ` +
      "When referencing any Salesforce record — whether just created, updated, or mentioned in conversation — " +
      `always build the full Lightning URL: ${baseUrl}/lightning/r/{ObjectType}/{recordId}/view. ` +
      "For example: a Contact with Id 003xx would be " +
      `${baseUrl}/lightning/r/Contact/003xx/view. ` +
      "NEVER use bare record IDs, relative paths, or placeholder URLs. " +
      "Always render the link as markdown, e.g. [View in Salesforce](<full url>)."
    );
  }
  parts.push(buildRiskBriefingGuidance());
  if (resourceContext) parts.push(resourceContext);
  return parts.join("\n\n");
}

function buildRiskBriefingGuidance(): string {
  const lookback = PIPELINE_HEURISTICS.recentLossVolume.lookbackDays;
  return (
    "ACCOUNT RISK BRIEFING:\n\n" +
    "You have a tool called render_account_risk_briefing that displays a Risk Briefing card " +
    "overlaid on the user's screen. Use it when the user asks for a risk briefing, risk view, " +
    "or risk dashboard on an account. Also OFFER a briefing proactively when, during normal " +
    "conversation, you fetch account data and notice risk signals (no recent activity, multiple " +
    "closed-lost opportunities, stalled opportunities, single-contact accounts). When offering " +
    "proactively, ask the user to confirm before producing the briefing. Suggest at most ONCE " +
    "per conversation and do not suggest if the user has already viewed a briefing.\n\n" +
    "PROCESS — follow these steps every time:\n\n" +
    "1. Gather data for the account using available tools. You need:\n" +
    "   a) Past-dated Tasks (Subject, ActivityDate) for the account\n" +
    "   b) Past-dated Events (Subject, ActivityDate) for the account\n" +
    "   c) Contact count for the account\n" +
    "   d) Open Opportunities (Name, StageName, LastModifiedDate) — IsClosed = FALSE\n" +
    `   e) Closed-Lost Opportunities (Name, CloseDate) in the last ${lookback} days\n` +
    "   Use whatever tools are available. In Hosted mode use a SOQL query tool; in Local mode " +
    "   use specific tools like sf_get_opportunities, sf_get_tasks, etc.\n\n" +
    "2. Apply the bank's risk heuristics (below) DETERMINISTICALLY. Same data MUST yield the " +
    "   same severity every time. Do not guess — compute from the rules.\n\n" +
    "3. Determine contributing factors. Include a factor entry ONLY for signals that fired " +
    "   Medium or High. Use clear human phrasing, for example:\n" +
    "   - \"Last touchpoint was N days ago\"\n" +
    "   - \"Only N activities in the last 90 days\"\n" +
    "   - \"Single-threaded relationship — N contact on file\"\n" +
    "   - \"X of Y open opportunities stalled (no update in 30+ days)\"\n" +
    "   - \"N opportunities lost in the last 180 days\"\n" +
    "   - \"No open opportunities and N closed-lost in last 180 days\"\n\n" +
    "4. Build the metrics arrays (three per dimension):\n" +
    "   - Engagement: Days Since Touch (or N/A), Activities (90d), Contacts\n" +
    "   - Pipeline: Open Opps, Stalled, Closed Lost (180d)\n\n" +
    "5. Write ONE-SENTENCE natural summaries per dimension (the only agent-written part). " +
    "   Everything else — severity, factors, metrics — is mechanical.\n\n" +
    "6. Handle empty states. If an account has zero activities and zero contacts (engagement) " +
    "   or zero open opps and zero recent losses (pipeline), set emptyState: true, " +
    "   severity: 'unknown', a summary describing the data gap, and OMIT metrics/factors.\n\n" +
    "7. Call render_account_risk_briefing with the structured assessment.\n\n" +
    heuristicsToPromptText()
  );
}

// Human-readable labels for completed tool calls (shown as badges on the message)
const TOOL_LABELS: Record<string, string> = {
  sf_list_accounts: "Listed accounts",
  sf_get_account: "Looked up account",
  sf_search_records: "Searched records",
  sf_get_opportunities: "Fetched opportunities",
  sf_get_contacts: "Fetched contacts",
  sf_get_cases: "Fetched cases",
  sf_get_pipeline_summary: "Queried pipeline data",
  sf_get_recent_activity: "Fetched recent activity",
  sf_run_soql: "Ran SOQL query",
  sf_create_task: "Created task",
  sf_log_activity: "Logged activity",
  sf_update_record: "Updated record",
  sf_create_record: "Created record",
};

// Present-tense status shown while a tool is executing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOOL_STATUS: Record<string, string> = {
  sf_list_accounts: "Listing accounts…",
  sf_get_account: "Looking up account…",
  sf_search_records: "Searching records…",
  sf_get_opportunities: "Fetching opportunities…",
  sf_get_contacts: "Fetching contacts…",
  sf_get_cases: "Fetching cases…",
  sf_get_pipeline_summary: "Querying pipeline data…",
  sf_get_recent_activity: "Fetching recent activity…",
  sf_run_soql: "Running SOQL query…",
  sf_create_task: "Creating task…",
  sf_log_activity: "Logging activity…",
  sf_update_record: "Updating record…",
  sf_create_record: "Creating record…",
};

/** Extract a record count from MCP tool result text. Returns null if not found. */
function extractRecordCount(text: string): number | null {
  // "Found N record(s)" / "Found N account(s)" / "Found N opportunity" etc.
  const foundMatch = text.match(/Found (\d+)/i);
  if (foundMatch) return parseInt(foundMatch[1], 10);
  // "Query returned N record(s)"
  const queryMatch = text.match(/Query returned (\d+)/i);
  if (queryMatch) return parseInt(queryMatch[1], 10);
  // JSON array heuristic: count top-level objects in a JSON block
  const jsonMatch = text.match(/```json\s*(\[[\s\S]*?\])/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1]) as unknown[];
      if (Array.isArray(arr)) return arr.length;
    } catch {}
  }
  return null;
}

// Write tools — used to emit write_complete SSE events
const WRITE_TOOLS = new Set([
  "sf_create_task",
  "sf_log_activity",
  "sf_update_record",
  "sf_create_record",
]);

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolCallRecord {
  name: string;
  label: string;
}

interface ToolInput {
  [key: string]: unknown;
}

// SSE helpers
const encoder = new TextEncoder();

function sseEvent(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ── MCP error detection ───────────────────────────────────────────────────

function isMcpAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid_token") ||
    msg.includes("invalid token") ||
    msg.includes("token expired") ||
    msg.includes("access_denied")
  );
}

/** True when the hosted MCP server dropped its session state (404 "not initialized"). */
function isMcpSessionDropped(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("not been initialized") ||
    msg.includes("please reconnect") ||
    (msg.includes("404") && msg.includes("initializ"))
  );
}

// ── MCP connection helper ─────────────────────────────────────────────────

async function connectMcpClient(
  accessToken: string,
  instanceUrl: string,
  mcpAccessToken?: string,
  effectiveMode: McpMode = "local",
): Promise<Client> {
  let transport: StdioClientTransport | StreamableHTTPClientTransport;

  if (effectiveMode === "hosted") {
    if (!hostedMcpServerUrl) {
      throw new Error("SF_MCP_SERVER_URL is required when MCP_MODE=hosted");
    }
    const bearerToken = mcpAccessToken ?? accessToken;
    transport = new StreamableHTTPClientTransport(new URL(hostedMcpServerUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: "application/json, text/event-stream",
        },
      },
    });
  } else {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [localMcpServerPath],
      env: {
        ...process.env,
        SF_ACCESS_TOKEN: accessToken,
        SF_INSTANCE_URL: instanceUrl,
        DOTENV_DISABLE: "true",
      },
    });
  }

  const client = new Client({ name: "sf-dashboard", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

// ── Tool / prompt execution helpers ──────────────────────────────────────

function extractText(content: unknown): string {
  return Array.isArray(content)
    ? (content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n")
    : "No results";
}

function extractPromptText(result: Awaited<ReturnType<Client["getPrompt"]>>): string {
  return result.messages
    .map((m) => (m.content.type === "text" ? (m.content as { type: "text"; text: string }).text : ""))
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const effectiveMode = getEffectiveMcpMode(session.mcpMode);

  if (effectiveMode === "hosted" && !session.mcpAccessToken) {
    return NextResponse.json({ error: "MCP_NOT_CONNECTED" }, { status: 401 });
  }

  // ── Pre-flight: proactive token refresh ───────────────────────────────────
  // Middleware handles page GET requests, but the chat API (POST) needs its own check.
  if (
    session.tokenIssuedAt &&
    session.refreshToken &&
    Date.now() - session.tokenIssuedAt > PROACTIVE_REFRESH_THRESHOLD_MS
  ) {
    try {
      await refreshSession(session);
    } catch {
      // Refresh failed — proceed with current token; reactive retry handles expiry mid-loop
    }
  }

  const body = await request.json().catch(() => null) as { messages?: ChatMessage[]; accountContext?: AccountContext } | null;
  if (!body?.messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const { messages, accountContext } = body;

  // Reference kept outside the stream so cancel() can abort an in-flight Anthropic stream
  let currentAnthropicStream: ReturnType<typeof anthropic.messages.stream> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let mcpClient: Client | null = null;
      let promptNames = new Set<string>();

      try {
        // ── Connect + list tools (+ prompts in hosted mode) ───────────────
        let anthropicTools: Anthropic.Tool[];
        let resourceContext = "";
        let mcpTokenRefreshed = false; // allow at most one MCP token refresh per request
        let mcpReconnected = false;    // allow at most one session-drop reconnect per request

        const connectAndList = async () => {
          mcpClient = await connectMcpClient(session.accessToken!, session.instanceUrl!, session.mcpAccessToken, effectiveMode);

          const [{ tools: mcpTools }, { prompts: mcpPrompts }] = await Promise.all([
            mcpClient.listTools(),
            effectiveMode === "hosted" ? mcpClient.listPrompts() : Promise.resolve({ prompts: [] }),
          ]);

          if (effectiveMode === "hosted") {
            const prompts = mcpPrompts;
            promptNames = new Set(prompts.map(p => p.name));
            const dedupedTools = deduplicateHostedTools(normalizeTools(mcpTools));
            const anthropicToolList = sanitizeToolPropertyNames([...dedupedTools, ...normalizePrompts(prompts)]);
            // Append route-level render tools after MCP normalization/dedup
            return [...anthropicToolList, ...RENDER_TOOLS];
          }

          // Local mode: inject resources into system prompt.
          // Skip on follow-up turns — context was already included in the first message.
          if (messages.length <= 1) {
            resourceContext = await fetchResourceContext(mcpClient, `${session.userId ?? "anon"}:${session.instanceUrl!}`);
          }

          promptNames = new Set();
          // Append route-level render tools after MCP normalization
          return [...sanitizeToolPropertyNames(normalizeTools(mcpTools)), ...RENDER_TOOLS];
        };

        try {
          anthropicTools = await connectAndList();
        } catch (connectErr) {
          if (effectiveMode === "hosted" && isMcpSessionDropped(connectErr) && !mcpReconnected) {
            // Server dropped its state — reconnect with same tokens, no refresh needed
            mcpReconnected = true;
            const staleClient = mcpClient as Client | null;
            if (staleClient) await staleClient.close().catch(() => {});
            mcpClient = null;
            anthropicTools = await connectAndList();
          } else if (
            effectiveMode === "hosted" &&
            isMcpAuthError(connectErr) &&
            session.mcpRefreshToken &&
            !mcpTokenRefreshed
          ) {
            mcpTokenRefreshed = true;
            controller.enqueue(sseEvent({ type: "status", text: "Refreshing MCP session…" }));
            await refreshMcpSession(session);
            const staleClient = mcpClient as Client | null;
            if (staleClient) await staleClient.close().catch(() => {});
            mcpClient = null;
            anthropicTools = await connectAndList();
          } else {
            throw connectErr;
          }
        }

        // Collected render directives from this request — last one wins
        let pendingRenderDirective: RenderDirective | null = null;

        // Routes to getPrompt() for prompt-backed tools, callTool() for everything else.
        // Closes over mcpClient and promptNames so retries automatically use the refreshed client.
        const execTool = async (toolUse: Anthropic.ToolUseBlock): Promise<string> => {
          // Route-level render tools: handled in-route, provider-independent
          if (RENDER_TOOL_NAMES.has(toolUse.name)) {
            const handled = handleRenderTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              accountContext?.accountId
            );
            if (handled) {
              pendingRenderDirective = handled.render;
              return handled.text;
            }
          }

          if (promptNames.has(toolUse.name)) {
            const result = await mcpClient!.getPrompt({
              name: toolUse.name,
              arguments: toolUse.input as Record<string, string>,
            });
            return extractPromptText(result);
          }
          const result = await mcpClient!.callTool({
            name: toolUse.name,
            arguments: toolUse.input as ToolInput,
          });
          // Capture render directive if tool returned one
          if (hasRenderDirective(result)) {
            pendingRenderDirective = result.render;
          }
          return extractText(result.content);
        };

        const runTool = async (toolUse: Anthropic.ToolUseBlock): Promise<string> => {
          try {
            return await execTool(toolUse);
          } catch (err) {
            // Per-tool reconnect for hosted session drops — one retry per call
            if (effectiveMode === "hosted" && isMcpSessionDropped(err)) {
              await mcpClient!.close().catch(() => {});
              mcpClient = await connectMcpClient(session.accessToken!, session.instanceUrl!, session.mcpAccessToken, effectiveMode);
              try {
                return await execTool(toolUse);
              } catch {
                return "Data temporarily unavailable. Please try again.";
              }
            }
            throw err;
          }
        };

        // ── Agentic loop ──────────────────────────────────────────────────
        const conversationMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Prepend account context into the last user message so it's adjacent to the question
        if (accountContext) {
          const lastIdx = conversationMessages.length - 1;
          const lastMsg = conversationMessages[lastIdx];
          if (lastMsg?.role === "user" && typeof lastMsg.content === "string") {
            const prefix = `[Context: The user is viewing ${accountContext.accountName}, Account ID ${accountContext.accountId}. ` +
              `Pronouns like "her", "his", "their" and references like "this account" or "this client" refer to ${accountContext.accountName}.]`;
            conversationMessages[lastIdx] = {
              role: "user",
              content: `${prefix} ${lastMsg.content}`,
            };
          }
        }

        const toolCallsUsed: ToolCallRecord[] = [];
        let continueLoop = true;
        let loopIterations = 0;
        let sessionRefreshed = false; // allow at most one SF session refresh per request

        // Four-way discriminated outcome so each branch is type-safe
        type ToolOutcome =
          | { kind: "ok";         result:  Anthropic.ToolResultBlockParam }
          | { kind: "sfExpired";  toolUse: Anthropic.ToolUseBlock }
          | { kind: "mcpExpired"; toolUse: Anthropic.ToolUseBlock }
          | { kind: "mcpDropped"; toolUse: Anthropic.ToolUseBlock };

        const systemPrompt = buildSystemPrompt(effectiveMode, resourceContext, undefined, session.instanceUrl ?? undefined);

        const callAnthropicWithRetry = async (
          params: Parameters<typeof anthropic.messages.stream>[0],
          onText: (text: string) => void,
          maxRetries = 3,
        ): Promise<Anthropic.Message | null> => {
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const anthropicStream = anthropic.messages.stream(params);
            currentAnthropicStream = anthropicStream;
            anthropicStream.on("text", onText);
            try {
              const message = await anthropicStream.finalMessage();
              currentAnthropicStream = null;
              return message;
            } catch (err) {
              currentAnthropicStream = null;
              if (err instanceof Anthropic.APIError && err.status === 529 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt + 1) * 1000;
                await new Promise<void>((r) => setTimeout(r, delay));
                continue;
              }
              if (err instanceof Anthropic.APIError && err.status === 529) {
                return null;
              }
              throw err;
            }
          }
          return null;
        };

        while (continueLoop) {
          if (++loopIterations > MAX_TOOL_ITERATIONS) {
            controller.enqueue(sseEvent({ type: "error", error: "Tool call limit reached — response may be incomplete." }));
            break;
          }
          const message = await callAnthropicWithRetry(
            {
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: systemPrompt,
              tools: anthropicTools,
              messages: conversationMessages,
            },
            (text) => controller.enqueue(sseEvent({ type: "token", text })),
          );

          if (!message) {
            controller.enqueue(sseEvent({ type: "token", text: "The AI service is temporarily busy. Please try again in a moment." }));
            continueLoop = false;
            break;
          }

          if (message.stop_reason === "tool_use") {
            conversationMessages.push({ role: "assistant", content: message.content });

            const toolUseBlocks = message.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            // ── First pass: run all tools; classify any auth failures ─────
            const firstPass: ToolOutcome[] = await Promise.all(
              toolUseBlocks.map(async (toolUse): Promise<ToolOutcome> => {
                toolCallsUsed.push({
                  name: toolUse.name,
                  label: TOOL_LABELS[toolUse.name] ?? `Called ${toolUse.name}`,
                });

                // Signal that this tool is starting
                controller.enqueue(
                  sseEvent({ type: "tool_start", toolId: toolUse.id, toolName: toolUse.name })
                );

                const callStart = Date.now();

                try {
                  const textContent = await runTool(toolUse);

                  // Enforce minimum 300ms querying phase so label is readable
                  const elapsed = Date.now() - callStart;
                  if (elapsed < 300) {
                    await new Promise<void>((r) => setTimeout(r, 300 - elapsed));
                  }

                  if (textContent.includes("SF_SESSION_EXPIRED")) {
                    controller.enqueue(
                      sseEvent({ type: "tool_result", toolId: toolUse.id, toolName: toolUse.name, recordCount: null, error: true })
                    );
                    return { kind: "sfExpired", toolUse };
                  }

                  const recordCount = extractRecordCount(textContent);
                  controller.enqueue(
                    sseEvent({ type: "tool_result", toolId: toolUse.id, toolName: toolUse.name, recordCount, error: false })
                  );

                  if (WRITE_TOOLS.has(toolUse.name)) {
                    const success = textContent.startsWith("✅");
                    const urlMatch = textContent.match(
                      /https:\/\/[^\s]+\/lightning\/r\/[^\s]+\/view/
                    );
                    controller.enqueue(
                      sseEvent({
                        type: "write_complete",
                        toolName: toolUse.name,
                        success,
                        url: urlMatch?.[0] ?? null,
                      })
                    );
                  }

                  return { kind: "ok", result: { type: "tool_result" as const, tool_use_id: toolUse.id, content: textContent } };
                } catch (err) {
                  controller.enqueue(
                    sseEvent({ type: "tool_result", toolId: toolUse.id, toolName: toolUse.name, recordCount: null, error: true })
                  );
                  if (effectiveMode === "hosted" && isMcpSessionDropped(err)) {
                    return { kind: "mcpDropped", toolUse };
                  }
                  // Hosted MCP transport throws on 401 — classify as mcpExpired for retry
                  if (effectiveMode === "hosted" && isMcpAuthError(err)) {
                    return { kind: "mcpExpired", toolUse };
                  }
                  return {
                    kind: "ok",
                    result: {
                      type: "tool_result" as const,
                      tool_use_id: toolUse.id,
                      content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
                      is_error: true,
                    },
                  };
                }
              })
            );

            const sfExpiredItems   = firstPass.filter((r): r is Extract<ToolOutcome, { kind: "sfExpired" }>   => r.kind === "sfExpired");
            const mcpExpiredItems  = firstPass.filter((r): r is Extract<ToolOutcome, { kind: "mcpExpired" }>  => r.kind === "mcpExpired");
            const mcpDroppedItems  = firstPass.filter((r): r is Extract<ToolOutcome, { kind: "mcpDropped" }>  => r.kind === "mcpDropped");

            let toolResults: Anthropic.ToolResultBlockParam[];

            // ── Branch 0: MCP server dropped session — reconnect and retry ─
            if (mcpDroppedItems.length > 0 && !mcpReconnected) {
              mcpReconnected = true;
              await mcpClient!.close().catch(() => {});
              mcpClient = await connectMcpClient(session.accessToken!, session.instanceUrl!, session.mcpAccessToken, effectiveMode);

              const droppedRetried = await Promise.all(
                mcpDroppedItems.map(async ({ toolUse }): Promise<Anthropic.ToolResultBlockParam> => {
                  try {
                    return { type: "tool_result" as const, tool_use_id: toolUse.id, content: await runTool(toolUse) };
                  } catch (err) {
                    return { type: "tool_result" as const, tool_use_id: toolUse.id, content: `Tool error: ${err instanceof Error ? err.message : String(err)}`, is_error: true };
                  }
                })
              );

              const droppedRetriedById = new Map(droppedRetried.map((r) => [r.tool_use_id, r]));
              toolResults = firstPass.map((item) =>
                item.kind === "mcpDropped"
                  ? droppedRetriedById.get(item.toolUse.id)!
                  : item.kind === "ok"
                  ? item.result
                  : { type: "tool_result" as const, tool_use_id: item.toolUse.id, content: "Retried after reconnect", is_error: true }
              );

            // ── Branch 1: MCP token expired — refresh and retry ───────────
            } else if (mcpExpiredItems.length > 0 && !mcpTokenRefreshed) {
              mcpTokenRefreshed = true;
              controller.enqueue(sseEvent({ type: "status", text: "Refreshing MCP session…" }));

              await refreshMcpSession(session);
              await mcpClient!.close().catch(() => {});
              mcpClient = await connectMcpClient(session.accessToken!, session.instanceUrl!, session.mcpAccessToken, effectiveMode);

              const mcpRetried = await Promise.all(
                mcpExpiredItems.map(async ({ toolUse }): Promise<Anthropic.ToolResultBlockParam> => {
                  try {
                    return { type: "tool_result" as const, tool_use_id: toolUse.id, content: await runTool(toolUse) };
                  } catch (err) {
                    return { type: "tool_result" as const, tool_use_id: toolUse.id, content: `Tool error: ${err instanceof Error ? err.message : String(err)}`, is_error: true };
                  }
                })
              );

              const mcpRetriedById = new Map(mcpRetried.map((r) => [r.tool_use_id, r]));
              toolResults = firstPass.map((item) =>
                item.kind === "mcpExpired" ? mcpRetriedById.get(item.toolUse.id)! : item.kind === "ok" ? item.result : { type: "tool_result" as const, tool_use_id: item.toolUse.id, content: "SF_SESSION_EXPIRED", is_error: true }
              );

            // ── Branch 2: SF session expired — refresh SF token and retry ─
            } else if (sfExpiredItems.length > 0 && !sessionRefreshed) {
              sessionRefreshed = true;
              controller.enqueue(sseEvent({ type: "status", text: "Refreshing Salesforce session…" }));

              const newToken = await refreshSession(session);

              await mcpClient!.close().catch(() => {});
              mcpClient = await connectMcpClient(newToken, session.instanceUrl!, session.mcpAccessToken, effectiveMode);

              const sfRetried = await Promise.all(
                sfExpiredItems.map(async ({ toolUse }): Promise<Anthropic.ToolResultBlockParam> => {
                  try {
                    return { type: "tool_result" as const, tool_use_id: toolUse.id, content: await runTool(toolUse) };
                  } catch (err) {
                    return { type: "tool_result" as const, tool_use_id: toolUse.id, content: `Tool error: ${err instanceof Error ? err.message : String(err)}`, is_error: true };
                  }
                })
              );

              const sfRetriedById = new Map(sfRetried.map((r) => [r.tool_use_id, r]));
              toolResults = firstPass.map((item) =>
                item.kind === "sfExpired" ? sfRetriedById.get(item.toolUse.id)! : item.kind === "ok" ? item.result : { type: "tool_result" as const, tool_use_id: item.toolUse.id, content: "MCP auth failed", is_error: true }
              );

            // ── Branch 3: exhausted retries ───────────────────────────────
            } else if (mcpDroppedItems.length > 0) {
              throw new Error("MCP server dropped session and reconnect already attempted");
            } else if (mcpExpiredItems.length > 0) {
              throw new Error("MCP_TOKEN_EXPIRED");
            } else if (sfExpiredItems.length > 0) {
              throw Object.assign(new Error("SF_SESSION_EXPIRED"), { isSessionExpired: true });

            // ── Branch 4: all tools succeeded ────────────────────────────
            } else {
              toolResults = firstPass.map((item) => (item as Extract<ToolOutcome, { kind: "ok" }>).result);
            }

            conversationMessages.push({ role: "user", content: toolResults });
          } else {
            // end_turn or max_tokens — done
            continueLoop = false;
          }
        }

        controller.enqueue(sseEvent({
          type: "done",
          toolCalls: toolCallsUsed,
          render: pendingRenderDirective,
        }));
      } catch (err) {
        const isSessionExpired =
          err instanceof Error &&
          (err.message === "SF_SESSION_EXPIRED" ||
            (err as { isSessionExpired?: boolean }).isSessionExpired);

        controller.enqueue(
          sseEvent({
            type: "error",
            error: isSessionExpired
              ? "SF_SESSION_EXPIRED"
              : err instanceof Error
              ? err.message
              : "Internal error",
          })
        );
      } finally {
        controller.close();
        try {
          await mcpClient?.close();
        } catch {
          // ignore cleanup errors
        }
      }
    },

    cancel() {
      // Client disconnected — abort the in-flight Anthropic request if any
      currentAnthropicStream?.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // prevent nginx from buffering SSE
    },
  });
}
