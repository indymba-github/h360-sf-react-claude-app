# H360 — Salesforce + Claude Reference App

A custom CRM frontend powered by Claude and Salesforce. Demonstrates three architectural patterns for connecting AI to CRM: a custom Model Context Protocol (MCP) server, Salesforce-hosted MCP, and Agentforce.

This is not a Salesforce application. It's a standalone Next.js app that connects to Salesforce via OAuth, uses Claude or Agentforce as the reasoning layer, and gives the builder full control over the UI — no Lightning Web Component constraints, no platform-imposed layouts.

Built as a reference implementation alongside a whitepaper on the architecture of AI-native CRM. The point isn't to replace any Salesforce surface. It's to explore what becomes possible when the experience layer is fully separable from the data and reasoning layers.

## What it does

The AI Assistant panel supports three pluggable providers:

- **Local** — Claude calls a custom MCP server via stdio, which authenticates to Salesforce using JWT Bearer. Full read/write via the tools exposed by the server (`sf_list_accounts`, `sf_get_pipeline_summary`, `sf_search_records`, and others).
- **Hosted** — Claude connects to a Salesforce-managed MCP endpoint scoped to the logged-in user's session. No separate server to run; data stays inside Salesforce's runtime.
- **Agentforce** — Delegates to a Salesforce Agentforce agent. Agent IDs are configurable in Settings — multiple agents can be saved as profiles and switched on the fly from the AI panel.

Beyond the chat, the app includes a dashboard with pipeline KPIs, a paginated accounts list, account detail pages with related records, briefing buttons that route through Agentforce, voice input, and configurable brand presets.

## Prerequisites

- Node.js 18 or higher
- A Salesforce org you can administer. Developer Edition (free at [developer.salesforce.com](https://developer.salesforce.com/signup)) works for the core features. Agentforce features may require a licensed Agentforce org (see Troubleshooting)
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
- Optional: a Salesforce-hosted MCP endpoint, if your org has one configured

## Quickstart

Clone the repo and install dependencies:

```bash
git clone https://github.com/indymba-github/h360-sf-react-claude-app.git
cd h360-sf-react-claude-app/dashboard
npm install
```

Copy the env template and fill in your credentials:

```bash
cp .env.example .env.local
```

At minimum you need: `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_LOGIN_URL`, `SF_CALLBACK_URL`, `ANTHROPIC_API_KEY`, and `SESSION_SECRET` (generate with `openssl rand -hex 32`). The full env var table is below.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click "Connect to Salesforce" to begin.

See `docs/SALESFORCE_SETUP.md` for the Salesforce-side configuration (External Client Apps, OAuth scopes, JWT certificate, Permission Sets).

## Architecture overview

┌─────────────────────────────────────────────────────────┐
│           Next.js App (React frontend)                  │
│                                                         │
│   Dashboard     Account Detail     AI Assistant Panel   │
│      ↓               ↓                    ↓             │
│   ───────────────────────────────────────────────────   │
│           Next.js API Routes (backend)                  │
│   ───────────────────────────────────────────────────   │
│      ↓               ↓                    ↓             │
│   Salesforce      Custom MCP        Anthropic Claude /  │
│   REST API        Server (stdio)    Agentforce Agent    │
│                                     API                 │
└─────────────────────────────────────────────────────────┘

The custom MCP server (`salesforce-mcp-server/`) is a separate Node.js process exposing Salesforce data as MCP tools. The dashboard launches it as a child process when Local mode is active. JWT Bearer authentication uses a self-signed certificate.

When Hosted MCP is active, the dashboard connects to Salesforce's hosted endpoint over HTTPS. When Agentforce is active, the dashboard authenticates with Client Credentials and routes chat through the Agent API.

## Project structure

dashboard/                  Next.js app
app/                      App Router pages and API routes
api/auth/               OAuth login/callback
api/chat/               Local Claude chat (with MCP tool calls)
api/agent/              Agentforce chat
api/agentforce/brief/   Account briefing (Agentforce)
api/prompts/execute/    Prompts library executor (Agentforce)
components/               React components
lib/
salesforce.ts           Salesforce REST API helpers
agents.ts               Agentforce profile management
agentforce-types.ts     Response parsing (Inform / Inquire / aggregates)
public/demo-packs/        Branding preset assets
salesforce-mcp-server/      Standalone MCP server (stdio transport)
src/tools/                MCP tool implementations
scripts/generate-cert.sh  RSA key pair generator for JWT auth
docs/                       Setup, customization, and troubleshooting guides

## MCP server setup

The custom MCP server uses the Salesforce OAuth 2.0 JWT Bearer flow — no user login redirect, no password storage.

```bash
cd salesforce-mcp-server
cp .env.example .env

./scripts/generate-cert.sh
# Upload the generated server.crt to your External Client App in Salesforce
# (Setup → App Manager → your app → OAuth Settings → Digital Signature)

npm install && npm run build
```

The dashboard launches the MCP server automatically when Local mode is active. To use the MCP server directly with Claude Code or the MCP Inspector, see `docs/SALESFORCE_SETUP.md`.

## Customization

Brand identity is fully configurable in Settings:

- Choose from a list of brand presets, or save your own
- Extract colors, logo, and fonts from any company website by URL
- Toggle light or dark mode (brand colors adapt automatically)
- Adjust border radius, fonts, and sidebar style

Detail in `docs/CUSTOMIZATION.md`:

- Managing multiple Agentforce agents
- Adding new tools to the local MCP server
- Available environment variables and what each one does

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key from console.anthropic.com |
| `SESSION_SECRET` | Yes | Encrypts the session cookie — generate with `openssl rand -hex 32` |
| `SF_CLIENT_ID` | Yes | Consumer Key from your Salesforce External Client App |
| `SF_CLIENT_SECRET` | Yes | Consumer Secret |
| `SF_LOGIN_URL` | Yes | `https://login.salesforce.com` (or `test.salesforce.com` for sandboxes) |
| `SF_CALLBACK_URL` | Yes | `http://localhost:3000/api/auth/callback` |
| `SF_MCP_SERVER_URL` | Optional | Salesforce-managed MCP endpoint URL |
| `SF_AGENT_CLIENT_ID` | Optional | OAuth client ID for Agentforce (Client Credentials flow) |
| `SF_AGENT_CLIENT_SECRET` | Optional | OAuth client secret for Agentforce |
| `SF_AGENT_ID` | Optional | Default Agentforce agent ID — seeds the first agent profile |
| `LOCAL_MCP_ENABLED` | Optional | Set to `false` to hide the Local provider in the AI panel |
| `AGENTFORCE_DEBUG` | Optional | Set to `true` to log raw Agentforce API responses for debugging |

See `dashboard/.env.example` for the full list with descriptions.

## Documentation

- `docs/SALESFORCE_SETUP.md` — End-to-end Salesforce org configuration
- `docs/CUSTOMIZATION.md` — Branding, AI providers, MCP tools
- `docs/TROUBLESHOOTING.md` — Common errors and how to resolve them

## License

MIT. See `LICENSE`.
