# Salesforce AI Dashboard — MCP Architecture Blueprint (Updated)

## What We're Building

A custom React frontend powered by a **Model Context Protocol (MCP) server** that connects to Salesforce. Instead of writing REST API calls by hand, you build a standardized MCP server that exposes Salesforce data as tools — and Claude uses those tools to answer questions, pull records, and analyze your CRM.

Think of it like this: REST APIs are like calling individual shops and asking them to read you their inventory over the phone. An MCP server is like hiring a personal shopper who already knows every store, speaks the language, and just brings you what you need.

**This is the architecture Salesforce is pushing with Headless 360** — you're just building your own version instead of waiting for their pilot.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Next.js App (React frontend)              │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Dashboard  │  │   Account    │  │     AI     │  │
│  │   KPIs      │  │   Detail     │  │   Advisor  │  │
│  └────────────┘  └──────────────┘  └────────────┘  │
├─────────────────────────────────────────────────────┤
│           Next.js API Routes (backend)              │
│  ┌──────────────────────────────────────────────┐   │
│  │  /api/chat — sends messages to Anthropic API │   │
│  │  with MCP server connected for SF data tools │   │
│  └──────────────────────┬───────────────────────┘   │
│                         │                           │
│  ┌──────────────────────▼───────────────────────┐   │
│  │  Salesforce MCP Server (Node.js / TypeScript) │   │
│  │  Exposes tools:                               │   │
│  │  • sf_search_records                          │   │
│  │  • sf_get_account                             │   │
│  │  • sf_list_accounts                           │   │
│  │  • sf_get_opportunities                       │   │
│  │  • sf_get_contacts                            │   │
│  │  • sf_get_cases                               │   │
│  │  • sf_get_pipeline_summary                    │   │
│  │  • sf_run_soql (guarded)                      │   │
│  └──────────────────────┬───────────────────────┘   │
└─────────────────────────┼───────────────────────────┘
                          ↓
                 Salesforce REST API
                 (JWT Bearer OAuth 2.0)
                 RBAC enforced server-side
```

---

## Progress Tracker

- [x] **Session 0:** External Client App + JWT Bearer setup
- [x] **Session 1:** MCP server scaffolding with stdio transport
- [x] **Session 2:** Full tool library (needs Rating field fix)
- [ ] **Session 3:** Next.js frontend scaffolding + OAuth for end users
- [ ] **Session 4:** Chat interface with MCP integration
- [ ] **Session 5:** Dashboard and account pages
- [ ] **Session 6:** Polish and deploy

---

## What's Already Done

### Session 0: Salesforce External Client App (COMPLETED)

You created an **External Client App** (not a legacy Connected App) in Salesforce Setup with:
- JWT Bearer Flow enabled
- Self-signed certificate uploaded (generated via `scripts/generate-cert.sh`)
- OAuth Policies set to "Admin approved users are pre-authorized"
- User assigned via Permission Set
- IP Relaxation: Enforce IP restrictions

**Key files:**
- `salesforce-mcp-server/server.key` — private key (never share/commit)
- `salesforce-mcp-server/server.crt` — public cert (uploaded to SF)

**Environment variables (in `.env`):**
```
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=<Consumer Key from External Client App>
SF_USERNAME=<your Salesforce username>
SF_PRIVATE_KEY_PATH=./server.key
```

### Sessions 1-2: MCP Server (COMPLETED — minor fix needed)

The MCP server is built at `~/sf-mcp-dashboard/salesforce-mcp-server` with:
- TypeScript + MCP SDK + jsforce + zod
- **stdio transport** (required for MCP Inspector and Claude Code)
- JWT Bearer authentication to Salesforce
- Full tool library with sf_ prefixed tools

**Known fix needed:** Remove `Rating` field from Account queries — the field doesn't exist in your dev org. Tell Claude Code:
```
Remove "Rating" from all Account SOQL queries across all tool 
files. The field doesn't exist in my org.
```

**Testing:**
```bash
cd ~/sf-mcp-dashboard/salesforce-mcp-server
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Lessons Learned (Gotchas to Avoid)

These are real issues hit during the build — reference these if something breaks:

1. **SOAP login is disabled by default** in newer SF orgs. Don't use username-password auth. Use JWT Bearer flow.
2. **External Client Apps ≠ legacy Connected Apps.** The UI is different. JWT setup lives under "Flow Enablement" → "Enable JWT Bearer Flow," not in the same place as legacy Connected Apps.
3. **The MCP Inspector requires stdio transport.** If the server uses HTTP/streamable transport, the Inspector fails with "Cannot POST /register." Use stdio for local dev.
4. **Security tokens may not be available** in newer orgs. Don't rely on them.
5. **External Client Apps don't appear in Permission Sets** until you set "Admin approved users are pre-authorized" in OAuth Policies.
6. **Verify fields exist in your org** before hardcoding SOQL. `Rating` doesn't exist on Account in all orgs. Use `isAccessible()` checks or test queries in Developer Console first.

---

## Remaining Sessions

### Session 3: Next.js Frontend — Scaffolding and OAuth

**Goal:** Next.js app with OAuth login for end users.

**Important:** The MCP server currently uses JWT Bearer flow for server-to-server auth. The frontend needs a *different* OAuth flow — the **Web Server flow** (Authorization Code) — so each end user logs in with their own Salesforce credentials. This preserves RBAC.

The architecture has two auth layers:
- **MCP server → Salesforce:** JWT Bearer (server-to-server, uses your cert)
- **User → Frontend → Salesforce:** Web Server OAuth (user logs in via browser)

When the frontend receives the user's access token from the OAuth callback, it passes that token to the MCP server for data queries, replacing the JWT-based token. This ensures all queries run as the logged-in user.

### What to tell Claude Code:

```
Create the Next.js frontend for the sf-mcp-dashboard project.
The MCP server already exists at ./salesforce-mcp-server.

Create the Next.js 14 app (App Router) in the root 
sf-mcp-dashboard directory with TypeScript and Tailwind CSS.

Structure:
- /app/page.tsx — landing page with "Connect to Salesforce"
- /app/dashboard/page.tsx — main dashboard (protected)
- /app/accounts/page.tsx — accounts list (protected)
- /app/accounts/[id]/page.tsx — account detail (protected)
- /app/layout.tsx — root layout with dark sidebar
- /app/api/auth/login/route.ts — initiates SF OAuth
- /app/api/auth/callback/route.ts — handles OAuth callback
- /app/api/auth/logout/route.ts — clears session
- /app/api/chat/route.ts — Anthropic API + MCP integration
- /lib/session.ts — encrypted cookie session management

Use the SAME External Client App that the MCP server uses.
The Consumer Key is already in the MCP server's .env file.

.env.local variables:
  SF_CLIENT_ID=(same Consumer Key)
  SF_CLIENT_SECRET=(Consumer Secret from External Client App)
  SF_LOGIN_URL=https://login.salesforce.com
  SF_CALLBACK_URL=http://localhost:3000/api/auth/callback
  ANTHROPIC_API_KEY=(existing key)
  SESSION_SECRET=(random 32-char string)

IMPORTANT: Add http://localhost:3000/api/auth/callback as 
an additional callback URL in the External Client App settings 
in Salesforce.

Implement OAuth 2.0 Web Server (Authorization Code) flow:
1. /api/auth/login redirects to SF authorize URL
2. /api/auth/callback exchanges code for access_token,
   refresh_token, instance_url — stores in encrypted
   HTTP-only cookie using iron-session
3. /api/auth/logout clears the cookie

Add middleware to redirect unauthenticated users to /.

Design:
- Dark sidebar with nav: Dashboard, Accounts
- Clean white content area
- User info in sidebar bottom
- Show connected org URL to confirm auth
```

**Checkpoint:** OAuth flow works, you're authenticated, app shows placeholders.

---

### Session 4: Chat Interface with MCP Integration

**Goal:** The AI chat panel that uses your MCP server for data access.

### What to tell Claude Code:

```
Build the chat interface and wire it to the MCP server.

BACKEND — /app/api/chat/route.ts:
When a user sends a message:

1. Get the user's SF access_token and instance_url from session
2. Spawn the salesforce-mcp-server as a child process, passing 
   the user's SF credentials as environment variables so all 
   queries run as that user (RBAC preserved)
3. Use the MCP client from @modelcontextprotocol/sdk to connect 
   to the server via stdio
4. Get the tool definitions from the MCP server
5. Call the Anthropic API with:
   - model: claude-sonnet-4-6
   - system prompt: "You are an AI assistant for relationship 
     managers at a bank. You have access to the full Salesforce 
     CRM via tools. Use the tools to look up real data before 
     answering. Be concise and specific."
   - messages: conversation history from the frontend
   - tools: mapped from MCP tool definitions to Anthropic format
6. Handle Claude's tool_use responses:
   - Route tool calls through the MCP client to the MCP server
   - Send tool results back to Claude
   - Loop until Claude produces a final text response
7. Return the assistant's response to the frontend
8. Disconnect the MCP client when done

FRONTEND — Chat component:
- Full-height chat panel
- User and assistant message bubbles
- Markdown rendering (react-markdown)
- Suggested prompt chips: "Pipeline summary",
  "High-risk accounts", "Search for a company",
  "Recent activity"
- Loading indicator with "Thinking..." and "Looking up data..."
  states (show when Claude is calling tools)
- Conversation history in React state
- Clear chat button
- Responsive layout

Design:
- Modern chat UI
- Tool usage shown as subtle inline indicators
  ("Looked up 5 accounts", "Queried pipeline data")
- Assistant messages support headers, bullets, bold
```

### How the flow works end to end:

```
User types: "What's our total pipeline?"
  → Frontend sends message to /api/chat
    → API route spawns MCP server with user's SF token
      → Sends message + tools to Anthropic API
        → Claude decides to call sf_get_pipeline_summary
          → MCP server queries SF as the authenticated user
          → Returns aggregated pipeline data
        → Claude formats a natural language response
      → Returns response to frontend
  → User sees: "Your total pipeline is $12.4M across 23 open
     opportunities. Negotiation stage has the highest value
     at $5.1M..."
```

**Checkpoint:** Chat with Claude, it calls MCP tools, responds with real Salesforce data.

---

### Session 5: Dashboard and Account Pages

**Goal:** Visual dashboard and detail pages that complement the chat.

### What to tell Claude Code:

```
Build the dashboard and account pages.

DASHBOARD (/app/dashboard/page.tsx):
- Use the MCP server to fetch:
  - Pipeline summary (sf_get_pipeline_summary)
  - Top 5 accounts by revenue (sf_list_accounts)
  - Recent activity (sf_get_recent_activity)
- Layout:
  - Top: KPI cards (Total Pipeline, Open Deals, Win Rate, Avg Deal)
  - Middle: Pipeline bar chart by stage (recharts)
  - Right side or bottom: Chat panel from Session 4
- Loading skeletons for each section

ACCOUNTS LIST (/app/accounts/page.tsx):
- Grid of account cards from sf_list_accounts
- Each card: Name, Industry tag, Revenue
- Search/filter bar
- Click → /accounts/[id]

ACCOUNT DETAIL (/app/accounts/[id]/page.tsx):
- Hero: Account name, industry, revenue, employees
- Opportunities section (sf_get_opportunities)
- Contacts section (sf_get_contacts)
- Cases section (sf_get_cases)
- Chat panel scoped to this account

Design:
- Clean, modern, looks nothing like Salesforce
- KPI cards with large numbers
- Pipeline stages color-coded
- Responsive layout
```

**Checkpoint:** Dashboard with live data, account detail, chat everywhere.

---

### Session 6: Polish and Deploy

**Goal:** Production-ready polish, then deploy.

### What to tell Claude Code:

```
Polish the app:
1. Token refresh — if SF returns 401, re-authenticate
2. Error boundaries around each data section
3. Empty states ("No opportunities found")
4. Chat tool-usage indicators (which tools Claude called)
5. "View in Salesforce" links on cards
6. Responsive design
7. "Powered by Claude" footer in chat

For deployment:
1. Vercel-compatible configuration
2. Updated .env.example with production notes
3. Add production callback URL to External Client App
4. README.md with architecture diagram and setup steps
```

**Checkpoint:** Deployed with a shareable URL.

---

## Stretch Goals

### Streaming Responses
- Anthropic streaming API for typewriter effect
- Show tool calls in real time

### Write Operations
- sf_create_task, sf_log_activity tools
- Claude creates follow-up tasks after analysis
- destructiveHint: true annotations

### Swap in Salesforce Hosted MCP Server
- When Salesforce's hosted MCP servers go GA, replace 
  your custom MCP server with theirs
- Frontend and chat stay exactly the same
- Only the MCP server layer changes

---

## Troubleshooting Quick Reference

| Problem | Fix |
|---------|-----|
| "SOAP API login() is disabled" | Use JWT Bearer flow, not username-password |
| "Cannot POST /register" in Inspector | MCP server using HTTP transport — switch to stdio |
| "No such column 'Rating'" | Remove Rating from SOQL queries — field not in your org |
| MCP Inspector won't connect | Run `npm run build` first. Verify `node dist/index.js` runs without crashing |
| External Client App not in Permission Sets | Set OAuth Policies → "Admin approved users are pre-authorized" first |
| JWT auth fails | Verify cert uploaded, Consumer Key matches, username matches, Permission Set assigned |
| Chat is slow | Each tool call = ~200-500ms to SF. Pipeline summary with aggregation = ~1s |
| RBAC not working | Pass per-user token, not shared JWT. Each user must OAuth in individually |

---

## Project Structure

```
sf-mcp-dashboard/
├── salesforce-mcp-server/       ← MCP server (Sessions 0-2, DONE)
│   ├── src/
│   │   ├── index.ts             ← Server entry (stdio transport)
│   │   ├── salesforce.ts        ← JWT Bearer auth to SF
│   │   └── tools/               ← Tool implementations
│   ├── server.key               ← Private key (never commit)
│   ├── server.crt               ← Public cert (uploaded to SF)
│   ├── .env                     ← SF credentials (never commit)
│   └── dist/                    ← Compiled JS
├── app/                         ← Next.js frontend (Sessions 3-6)
│   ├── page.tsx
│   ├── dashboard/
│   ├── accounts/
│   ├── api/
│   │   ├── auth/
│   │   └── chat/
│   └── layout.tsx
├── lib/                         ← Shared helpers
├── .env.local                   ← Frontend env vars (never commit)
└── package.json
```

---

## What This Proves

This demo is a triple threat in a strategy conversation:

1. **MCP fluency** — you built a standards-compliant MCP server before most people have heard of the protocol
2. **Salesforce architecture** — paired with your native LWC, you've shown inside-the-platform AND outside-the-platform capability
3. **AI-native product thinking** — the CRM of the future IS a chat interface with structured data behind it

When Salesforce's Hosted MCP Servers go GA, you can say: "I already built this pattern from scratch — I know exactly what Headless 360 is doing under the hood."

---

## Claude Code Session Tips

1. **Start each session** with:
   > "I'm building a Salesforce MCP server and Next.js dashboard.
   > Sessions 0-2 are complete. The MCP server is at 
   > ./salesforce-mcp-server with JWT Bearer auth and stdio 
   > transport. Now let's do Session [N]. Here's the spec: 
   > [paste section]."

2. **One session = one feature.** Don't combine.

3. **Test MCP tools with the Inspector** before integrating with the frontend.

4. **Keep credentials safe** — .env files and .key files never get committed.
