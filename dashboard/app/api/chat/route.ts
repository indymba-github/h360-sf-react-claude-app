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
  console.log("Raw tools from hosted MCP:", tools.length);
  console.log("After dedup:", deduped.length);
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
    console.log('=== RESOURCES (from cache) ===');
    return cached.context;
  }

  try {
    const { resources } = await client.listResources();

    console.log('=== RESOURCES LOADED ===');
    console.log('Resource count:', resources.length);
    resources.forEach(r => console.log(' -', r.uri));

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

        console.log('=== RESOURCE CONTENT ===');
        console.log(title + ':', text.substring(0, 200) + '...');

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
  "4. After a successful write, provide the Salesforce link to the created or updated record.\n" +
  "5. If the user says 'no' or 'cancel', acknowledge and do not call the tool.\n\n" +
  "You can suggest write actions proactively when analysis reveals action items — for example, " +
  "after reviewing an account you might say 'I notice there are no follow-up tasks scheduled. " +
  "Would you like me to create one?'";

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

function buildSystemPrompt(mode: McpMode, resourceContext = "", accountContext?: AccountContext): string {
  const base = mode === "hosted" ? BASE_SYSTEM_PROMPT + HOSTED_PROMPT_ADDENDUM : BASE_SYSTEM_PROMPT;
  const parts: string[] = [];
  if (accountContext) parts.push(buildAccountContextBlock(accountContext));
  parts.push(base);
  if (resourceContext) parts.push(resourceContext);
  return parts.join("\n\n");
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

  console.log('Connecting to MCP server...');
  console.log('Transport type:', effectiveMode);

  if (effectiveMode === "hosted") {
    if (!hostedMcpServerUrl) {
      throw new Error("SF_MCP_SERVER_URL is required when MCP_MODE=hosted");
    }
    const bearerToken = mcpAccessToken ?? accessToken;
    console.log("=== HOSTED MCP CONNECT ===");
    console.log("URL:", hostedMcpServerUrl);
    console.log("Token present:", !!bearerToken);
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
  if (effectiveMode === "hosted") {
    console.log("=== HOSTED MCP CONNECTED ===");
    console.log("Tools and prompts available");
  }
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
  console.log('Effective MCP mode:', effectiveMode, '(session:', session.mcpMode ?? "unset", ', env:', process.env.MCP_MODE ?? "unset", ')');

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

  console.log('=== ACCOUNT CONTEXT ===');
  console.log('Context received:', accountContext ?
    `${accountContext.accountName} (${accountContext.accountId})` :
    'none');

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

          console.log('=== MCP CONNECTION ===');
          console.log('Mode:', effectiveMode);

          const [{ tools: mcpTools }, { prompts: mcpPrompts }] = await Promise.all([
            mcpClient.listTools(),
            effectiveMode === "hosted" ? mcpClient.listPrompts() : Promise.resolve({ prompts: [] }),
          ]);

          console.log('=== TOOLS ===');
          console.log('Tool count:', mcpTools.length);
          mcpTools.forEach(t => console.log(' -', t.name));

          if (effectiveMode === "hosted") {
            const prompts = mcpPrompts;

            console.log('=== PROMPTS LOADED ===');
            console.log('Prompt count:', prompts.length);
            prompts.forEach(p => console.log(' -', p.name));

            promptNames = new Set(prompts.map(p => p.name));
            const dedupedTools = deduplicateHostedTools(normalizeTools(mcpTools));
            const anthropicToolList = sanitizeToolPropertyNames([...dedupedTools, ...normalizePrompts(prompts)]);

            const systemPrompt = buildSystemPrompt(effectiveMode, "", accountContext);
            console.log('=== SYSTEM PROMPT PREVIEW ===');
            console.log(systemPrompt.substring(0, 300));

            return anthropicToolList;
          }

          // Local mode: inject resources into system prompt.
          // Skip on follow-up turns — context was already included in the first message.
          if (messages.length <= 1) {
            resourceContext = await fetchResourceContext(mcpClient, `${session.userId ?? "anon"}:${session.instanceUrl!}`);
          }

          const systemPrompt = buildSystemPrompt(effectiveMode, resourceContext, accountContext);
          console.log('=== SYSTEM PROMPT PREVIEW ===');
          console.log(systemPrompt.substring(0, 300));

          promptNames = new Set();
          return sanitizeToolPropertyNames(normalizeTools(mcpTools));
        };

        try {
          anthropicTools = await connectAndList();
        } catch (connectErr) {
          if (effectiveMode === "hosted" && isMcpSessionDropped(connectErr) && !mcpReconnected) {
            // Server dropped its state — reconnect with same tokens, no refresh needed
            mcpReconnected = true;
            console.log("=== MCP RECONNECT ===");
            console.log("Reason: server not initialized");
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

        // Routes to getPrompt() for prompt-backed tools, callTool() for everything else.
        // Closes over mcpClient and promptNames so retries automatically use the refreshed client.
        const execTool = async (toolUse: Anthropic.ToolUseBlock): Promise<string> => {
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
          return extractText(result.content);
        };

        const runTool = async (toolUse: Anthropic.ToolUseBlock): Promise<string> => {
          console.log('=== TOOL CALL ===');
          console.log('Tool:', toolUse.name);
          console.log('Input:', JSON.stringify(toolUse.input).substring(0, 200));

          try {
            const text = await execTool(toolUse);
            console.log('=== RESPONSE ===');
            console.log('Length:', text.length, 'chars');
            return text;
          } catch (err) {
            // Per-tool reconnect for hosted session drops — one retry per call
            if (effectiveMode === "hosted" && isMcpSessionDropped(err)) {
              console.log("=== MCP SESSION EXPIRED, RECONNECTING ===");
              await mcpClient!.close().catch(() => {});
              mcpClient = await connectMcpClient(session.accessToken!, session.instanceUrl!, session.mcpAccessToken, effectiveMode);
              try {
                const text = await execTool(toolUse);
                console.log('=== RESPONSE (after reconnect) ===');
                console.log('Length:', text.length, 'chars');
                return text;
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

        const systemPrompt = buildSystemPrompt(effectiveMode, resourceContext);

        while (continueLoop) {
          if (++loopIterations > MAX_TOOL_ITERATIONS) {
            controller.enqueue(sseEvent({ type: "error", error: "Tool call limit reached — response may be incomplete." }));
            break;
          }
          console.log('=== FULL SYSTEM PROMPT LENGTH ===');
          console.log('Characters:', systemPrompt.length);
          console.log('First 200 chars:', systemPrompt.substring(0, 200));
          console.log('Last 200 chars:', systemPrompt.substring(systemPrompt.length - 200));
          const anthropicStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemPrompt,
            tools: anthropicTools,
            messages: conversationMessages,
          });
          currentAnthropicStream = anthropicStream;

          // Stream text tokens to the client as they arrive
          anthropicStream.on("text", (text) => {
            controller.enqueue(sseEvent({ type: "token", text }));
          });

          const message = await anthropicStream.finalMessage();
          currentAnthropicStream = null;

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

                controller.enqueue(
                  sseEvent({
                    type: "status",
                    text: TOOL_STATUS[toolUse.name] ?? `Calling ${toolUse.name}…`,
                  })
                );

                try {
                  const textContent = await runTool(toolUse);

                  if (textContent.includes("SF_SESSION_EXPIRED")) {
                    return { kind: "sfExpired", toolUse };
                  }

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
              console.log("=== MCP RECONNECT ===");
              console.log("Reason: server not initialized");

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

        controller.enqueue(sseEvent({ type: "done", toolCalls: toolCallsUsed }));
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
