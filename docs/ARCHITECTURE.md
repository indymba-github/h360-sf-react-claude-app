# Architecture

How the app's pieces fit together. Read this if you're extending the codebase, debugging a deep issue, or trying to understand why the design looks the way it does.

For getting the app running, see `SALESFORCE_SETUP.md`. For day-to-day Settings page configuration, see `SETTINGS.md`. For code-level customization (extending tools, adding components), see `CUSTOMIZATION.md`.

## System overview

```

┌─────────────────────────────────────────────────────────┐
│           Next.js Dashboard (React frontend)            │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  Dashboard │  │   Account    │  │  AI Assistant  │   │
│  │   KPIs     │  │   Detail     │  │  (3 modes)     │   │
│  │  Alerts    │  │   Related    │  │  Local/Hosted/ │   │
│  │  Pipeline  │  │   Briefings  │  │  Agentforce    │   │
│  └────────────┘  └──────────────┘  └────────────────┘   │
├─────────────────────────────────────────────────────────┤
│           Next.js API Routes (backend)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │/api/auth │ │/api/chat │ │/api/agent│ │/api/      │   │
│  │OAuth     │ │Claude +  │ │Agentforce│ │settings   │   │
│  │flows     │ │MCP tools │ │Agent API │ │/extract   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────────┘   │
└───────┼────────────┼────────────┼───────────────────────┘
        │            │            │
        ▼            ▼            ▼
   Salesforce    ┌─────────┐   Agentforce
   REST API      │ MCP     │   Agent API
   (OAuth 2.0)   │ Server  │   (api.salesforce.com)
                 └────┬────┘
                      │
              ┌───────┴────────┐
              ▼                ▼
         Local MCP        Salesforce
         (stdio,          Hosted MCP
          JWT Bearer)     (api.salesforce.com)
```

## Three AI modes

The AI Assistant panel exposes a three-segment toggle: **Local | Hosted | Agentforce**. The core demo narrative is that the same question across all three modes produces equivalent answers from different governance postures and infrastructure paths.

### Local mode

- Claude (Anthropic) as the reasoning model
- Custom TypeScript MCP server authenticates to Salesforce via JWT Bearer
- Tools live in `salesforce-mcp-server/src/tools/` (extensible — see `CUSTOMIZATION.md`)
- Full tool flexibility, any query pattern possible
- Data leaves Salesforce to reach Claude (no Salesforce Trust Layer applies)

### Hosted mode

- Claude (Anthropic) as the reasoning model
- Salesforce's Hosted MCP Server provides the tools
- Same frontend, same Claude integration, different data layer
- Runtime swap from Local to Hosted requires zero code changes (env var configuration only)
- Data leaves Salesforce to reach Claude (no Trust Layer)

### Agentforce mode

- Salesforce's Agentforce Agent API as the reasoning engine
- Client Credentials Flow for server-to-server auth
- Trust Layer governs: PII masking, toxicity filtering, prompt defense, audit logging
- Data stays inside Salesforce's governance perimeter
- No Anthropic API calls in this mode

## Authentication flows

The app uses up to four distinct OAuth flows depending on which providers are configured.

| Flow | Type | Purpose | Where used |
|---|---|---|---|
| 1. Dashboard OAuth | Authorization Code + PKCE | User logs into the dashboard via browser | All Salesforce REST API calls from the dashboard, Local MCP user context |
| 2. Local MCP JWT | JWT Bearer with RSA cert | Server-to-server auth for the custom MCP server | All tool calls when chat is in Local mode |
| 3. Hosted MCP OAuth | Authorization Code + PKCE | User authorizes Salesforce's Hosted MCP | All tool/prompt calls when chat is in Hosted mode |
| 4. Agentforce | Client Credentials Flow | Server-to-server auth for Agent API | Agentforce chat mode and briefing button execution |

Flows 1 and 2 can share an External Client App if you enable both Authorization Code and JWT Bearer flows on the same app. Flow 4 (Agentforce) requires a separate External Client App because its narrow scope requirement (`sfap_api`, `api`) conflicts with the broader scopes the dashboard uses for flow 1.

See `SALESFORCE_SETUP.md` for the step-by-step configuration of each flow.

## Chat route data flows

### Local mode
```
User message
→ /api/chat route
→ Spawn local MCP server as child process (if not already running)
→ Load MCP resources into system prompt
→ Get tool definitions from MCP
→ Send to Anthropic API (Claude) with tools
→ Claude calls tools → MCP server queries Salesforce
→ Loop until Claude produces final response
→ Return to frontend
```

The MCP server is spawned per session and uses stdio for communication. The user's Salesforce access token (from the dashboard's session cookie) is passed through as an environment variable so all queries enforce RBAC for the logged-in user.

### Hosted mode
```
User message
→ /api/chat route
→ Connect to Salesforce Hosted MCP via StreamableHTTPClientTransport
→ Headers: Authorization (MCP token) + Accept (json + event-stream)
→ MCP handshake: initialize → notifications/initialized → ready
→ Get tools (deduplicate across permission scopes)
→ Send to Anthropic API (Claude) with tools
→ Claude calls tools → Hosted MCP queries Salesforce
→ Loop until final response
→ Return to frontend
```

The Hosted MCP handshake is a three-step process: `initialize` → `notifications/initialized` → tool calls. Skipping the second step causes persistent 404 errors. Hosted MCP also typically returns tools duplicated across permission scopes (reads, all, mutations, deletes); the app deduplicates these before sending to Claude.

### Agentforce mode

```
User message
→ /api/agent route
→ Get client credentials token (JWT-based)
→ Start agent session at api.salesforce.com
Body: { externalSessionKey, instanceConfig.endpoint, bypassUser }
→ Send message to agent
→ Agent routes to Topic → selects Action → executes
→ Trust Layer governs (PII masking, filtering, logging)
→ Parse structured response (Inform / Inquire / aggregates)
→ Return agent response to frontend
→ End session
```

The Agentforce API uses `api.salesforce.com` (NOT the org's My Domain URL). The session is authenticated with a JWT-based access token, not the user's session token. The `bypassUser` flag controls whether the session is bound to a specific Salesforce user.

The response from Agentforce can contain multiple structural fields: a conversational text message, structured choice picker data (`collect`), structured query results (`result.value.result` as an array or HTML string). See `dashboard/lib/agentforce-types.ts` for the parser that normalizes all of these.

## MCP server tools

The custom MCP server in `salesforce-mcp-server/` exposes a curated set of tools. Tool names use the `sf_` prefix. Tools are organized into topic files in `salesforce-mcp-server/src/tools/` — see the source for the current inventory.

Tools follow a few common patterns:

- **Read tools** return JSON data and have `readOnlyHint: true`
- **Write tools** have `destructiveHint: true` and follow a two-step confirmation pattern: Claude describes the proposed change in conversational text, then waits for explicit user approval before invoking
- **Search and query tools** support multiple parameters but prefer narrow, focused query semantics over arbitrary SOQL passthrough

See `CUSTOMIZATION.md` for instructions on adding new tools.

## MCP resources

In addition to tools, the MCP server exposes resources — non-tool context loaded into Claude's system prompt at session start. Resources let Claude know what's available in the org before making any tool calls, reducing wasted tool invocations and improving response quality.

Typical resources include schema (available objects, key fields), user profile (current user's role and permissions), and picklist values.

## Resilience patterns

The app handles several known failure modes automatically:

- **Anthropic API 529 (Overloaded):** Exponential backoff retry (2s/4s/8s), max 3 retries, then a friendly error message
- **Hosted MCP "not initialized" 404:** Auto-reconnect with new transport and retry once
- **Hosted MCP tool deduplication:** Tools across permission scopes (reads/all/mutations/deletes) are deduplicated to a unique set before being passed to Claude
- **Session token expiry:** Tokens are refreshed automatically on 401 errors when refresh tokens are available
- **Account context injection:** When viewing an account, context is injected at the top of the system prompt AND prepended to the user message (belt-and-suspenders against context drop)
- **Date awareness:** Current date is injected into the system prompt across all modes
- **Write operation confirmation:** Claude describes proposed changes and waits for explicit user approval before executing — applies to all MCP write tools

## Account context awareness

When the user is on an account detail page, the AI panel automatically scopes its context to that account:

- Shows "Viewing: [Account Name]" in the panel header
- Injects account context into the system prompt (top priority)
- Prepends account context to the user's message
- Pronouns like "her", "his", "this account" resolve to the current account

This is implemented in `dashboard/lib/use-ai-context.tsx` and propagates through all three providers (Local, Hosted, Agentforce). The context is a default, not a constraint — users can still ask about other accounts or the overall pipeline by being explicit in their question.

## News alert / notification system

The app surfaces notifications from Task records in Salesforce. The pattern:

- An external scanning agent creates Task records with:
  - Subject prefixed `News Alert:`
  - Description containing markdown-formatted text
  - `WhatId` linked to the relevant Account
  - `Status: Not Started` (active) or `Status: Completed` (dismissed)
- The dashboard:
  - Queries these Tasks via REST API on page load
  - Surfaces them on the dashboard (paginated) and account detail pages
  - Allows individual or bulk dismiss via `PATCH` on the Task status
  - Polls every 30 seconds via `/api/notifications` for new alerts
  - Renders a notification bell in the sidebar with badge count and dropdown
  - Calls `router.refresh()` when new alerts are detected

This is a generic pattern that works with any external alerting system that can create Salesforce Tasks. The scanning agent itself is not part of this repo — it's a separate component that you can implement in Apex, n8n, AWS Lambda, Zapier, or any system that can create Salesforce records.

## Brand extraction

The Settings page can extract branding from any company website URL. Implementation:

1. **CSS parsing** — Extracts hex colors from style tags, linked stylesheets, inline styles, `meta theme-color`
2. **AI vision analysis** — Sends the logo image and page HTML to Claude for visual brand analysis
3. **Returns** — Primary color, accent color, additional colors, heading font, body font, brand style
4. **UI** — Color swatches with apply affordances (per element or all-at-once)

The extractor is in `dashboard/lib/brand-extractor.ts`. The API route is `/api/settings/extract-brand`.

## Settings page

The Settings page exposes:

- **Profile** — Display name
- **Brand Identity** — Presets (saved configurations), Brand from website (URL-based extraction), App name & logo, Palette (Ink/Paper/Accent), Typography
- **Theme** — Light/Dark/System
- **Prompts library** — Configurable starter prompts per page
- **AI provider** — Provider status panel, Manage agents link (for Agentforce), Default provider dropdown

See `SETTINGS.md` for a full walkthrough.

## Where to look in the code

| Task | Files |
|---|---|
| Add a new MCP tool | `salesforce-mcp-server/src/tools/` (one file per topic) + register in `src/index.ts` |
| Change AI panel behavior | `dashboard/components/ChatPanel.tsx` |
| Modify Agentforce response rendering | `dashboard/lib/agentforce-types.ts` (parser) + `dashboard/components/AgentforceResults.tsx` and `AgentforceChoices.tsx` |
| Add a new dashboard section | `dashboard/components/` for the new section, then add it to `dashboard/app/dashboard/page.tsx` |
| Add a new SOQL query | `dashboard/lib/salesforce.ts` for dashboard queries, or a tool in `salesforce-mcp-server/src/tools/` for MCP queries |
| Add a new auth flow | `dashboard/app/api/auth/` (one route per step) + `dashboard/lib/session.ts` for session schema |
| Customize brand styling | `dashboard/lib/brandColors.ts` and `dashboard/app/globals.css` (CSS variables) |
| Adjust agent profile storage | `dashboard/lib/agents.ts` |
| Adjust prompt library logic | `dashboard/lib/prompts.ts` |
| Adjust notification polling | `dashboard/hooks/useNotificationPoller.ts` |
| Brand extraction | `dashboard/lib/brand-extractor.ts` and `dashboard/app/api/settings/extract-brand/` |

This document deliberately doesn't list every file — the code is the source of truth and these things shift. Use the file map above to find your entry point, then read the actual source.