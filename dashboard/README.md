# SF Dashboard

An AI-powered Salesforce CRM explorer. Query your pipeline, accounts, contacts, cases, and opportunities through a natural-language chat interface — all respecting Salesforce's own role-based access controls.

---

## Architecture

```
Browser
  │
  ├── Next.js App Router (dashboard/)
  │     ├── Server Components  ──► Salesforce REST API  (direct, per-user OAuth token)
  │     └── /api/chat  ──────────► Anthropic API (claude-sonnet-4-6)
  │                                     │
  │                                     └── MCP Client (stdio)
  │                                              │
  │                                              └── salesforce-mcp-server/
  │                                                    (Node.js subprocess)
  │                                                    └── Salesforce REST API
  │
  └── iron-session (encrypted cookie)
        └── { accessToken, refreshToken, instanceUrl, userId, … }
```

**Key design decisions:**

- Salesforce is used as a **headless data/logic layer** — this app never stores CRM records, only proxies requests using the user's own OAuth token. RBAC is enforced by Salesforce natively.
- The MCP (Model Context Protocol) server is a **subprocess spawned per chat request**. It receives the user's OAuth token at runtime, so Claude can only see what the authenticated user can see.
- Server components query Salesforce directly for page renders (fast, no extra hop). The MCP server is only used for the AI chat path.

---

## Project structure

```
sf-mcp-dashboard/
├── salesforce-mcp-server/   # TypeScript MCP server (9 SF tools)
│   └── src/
│       ├── index.ts         # stdio transport entry point
│       ├── salesforce.ts    # Connection + JWT/passthrough auth
│       └── tools/           # sf_list_accounts, sf_get_account, …
│
└── dashboard/               # Next.js 14 app (this directory)
    ├── app/
    │   ├── page.tsx          # Landing / OAuth login
    │   ├── dashboard/        # Pipeline KPIs + chart
    │   ├── accounts/         # Account list + detail
    │   └── api/
    │       ├── auth/         # login, callback, logout, refresh
    │       └── chat/         # Anthropic + MCP agentic loop
    ├── components/
    │   ├── AppShell.tsx      # Responsive layout + mobile sidebar
    │   ├── ChatPanel.tsx     # Chat UI with tool indicators
    │   ├── PipelineChart.tsx # recharts bar chart
    │   └── AccountSearch.tsx # Client-side search/filter
    └── lib/
        ├── salesforce.ts     # Typed SF REST helpers (server-only)
        └── session.ts        # iron-session v8 helpers
```

---

## Local setup

### Prerequisites

- Node.js 18+
- A Salesforce org (Developer Edition, sandbox, or production)
- An Anthropic API key

### 1. Create a Salesforce External Client App

1. **Setup → External Client Apps → New**
2. Enable **OAuth settings**
3. Add callback URL: `http://localhost:3000/api/auth/callback`
4. Scopes: `api`, `refresh_token`
5. **Enable PKCE** (required — this app uses `S256` challenge method)
6. Note your **Consumer Key** (client ID) and **Consumer Secret**

### 2. Build the MCP server

```bash
cd salesforce-mcp-server
npm install
npm run build
```

### 3. Configure the dashboard

```bash
cd dashboard
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_LOGIN_URL=https://login.salesforce.com
SF_CALLBACK_URL=http://localhost:3000/api/auth/callback
ANTHROPIC_API_KEY=sk-ant-...
SESSION_SECRET=<64-char hex string>
```

Generate `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Connect to Salesforce**.

---

## Deploying to Vercel

### 1. Add production callback URL to your External Client App

In Salesforce Setup → External Client Apps → your app → OAuth Settings, add:

```
https://your-app.vercel.app/api/auth/callback
```

### 2. Import the project

- Connect your GitHub repo to Vercel
- Set **Root Directory** = `dashboard`
- Vercel picks up `vercel.json` automatically — it will build the MCP server first, then Next.js

### 3. Set environment variables

In Vercel project settings → Environment Variables, add all keys from `.env.local.example`, replacing:

```
SF_CALLBACK_URL=https://your-app.vercel.app/api/auth/callback
```

`SESSION_SECRET` must be set to a strong random value (different from your local one).

### How the MCP server works on Vercel

`next.config.mjs` uses `outputFileTracingIncludes` to bundle `salesforce-mcp-server/dist/**` into the `/api/chat` serverless function. The chat route spawns it as a child process using `process.execPath` (Node.js binary that Vercel provides at runtime). No separate server is needed.

If you ever move the MCP server to a different path, set `MCP_SERVER_PATH` in your Vercel environment variables.

---

## MCP tools

| Tool | Description |
|------|-------------|
| `sf_list_accounts` | Lists accounts with optional keyword filter |
| `sf_get_account` | Full account detail by ID |
| `sf_search_records` | SOSL search across multiple objects |
| `sf_get_opportunities` | Opportunities for an account |
| `sf_get_contacts` | Contacts for an account |
| `sf_get_cases` | Cases for an account |
| `sf_get_pipeline_summary` | Open pipeline grouped by stage |
| `sf_get_recent_activity` | Recently modified records |
| `sf_run_soql` | Executes a SELECT SOQL query (read-only guard) |

---

## Session & token refresh

- Sessions are stored in an encrypted HTTP-only cookie (iron-session)
- On Salesforce 401, the chat route returns HTTP 401 to the browser
- The ChatPanel automatically calls `/api/auth/refresh` (token refresh grant) and retries once
- If refresh fails, a banner prompts re-authentication via `/api/auth/login`
- Server-rendered pages redirect to `/api/auth/login` on `SF_SESSION_EXPIRED`
