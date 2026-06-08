# H360 — Salesforce + Claude Reference App (v2.0.0)

A custom CRM frontend powered by Claude and Salesforce Financial Services Cloud on Core. Demonstrates four architectural patterns for connecting AI to enterprise CRM data: a custom MCP server, Salesforce-hosted MCP, Agentforce (Trust Layer governed), and the Salesforce Models API (Trust Layer direct).

This is not a Salesforce application. It is a standalone Next.js app that connects to Salesforce via OAuth, uses Claude, Agentforce, or the Salesforce Models API as the reasoning layer, and gives the builder full control over the UI — no Lightning Web Component constraints, no platform-imposed layouts.

Built as a reference implementation for architects and developers exploring what becomes possible when the experience layer is fully separable from the data and reasoning layers.

## What it demonstrates

### AI modes

| Mode | How it works |
|------|-------------|
| **Local MCP** | Claude (Anthropic direct) calls a custom MCP server via stdio. The MCP server authenticates to Salesforce using JWT Bearer. Full read/write via 19 exposed tools. |
| **Hosted MCP** | Claude connects to a Salesforce-managed MCP endpoint scoped to the logged-in user's session. No separate server process. |
| **Agentforce** | Delegates to a configured Salesforce Agentforce agent. Multiple agent profiles are configurable in Settings and can be switched on the fly. All requests are governed by Salesforce Trust Layer. |
| **Trust Layer (Models API)** | Routes Claude, OpenAI GPT, Google Gemini, Amazon Titan, and NVIDIA models through Salesforce's Trust Layer. No Anthropic key required. Model picker lets you switch providers from the AI panel. |

### Application features

- Dashboard with pipeline KPIs, aging pipeline chart, and today's agenda
- Paginated accounts list with search
- Account detail pages with related contacts, opportunities, cases, tasks, financial accounts, and news alerts
- Financial Accounts section backed by FSC on Core standard objects (`FinancialAccount`, `FinancialAccountParty`)
- Agentforce briefing buttons on account detail (generates Account Risk Briefing via Agentforce)
- News alerts system with clickable signal cards
- Generative UI: mortgage calculator and Account Risk Briefing rendered as structured cards inline in chat
- Account context awareness — chat panel pre-fetches account data when on an account detail page
- Voice input with transcript-to-message routing

### New in v2.0.0

- **Trust Layer toggle** — routes Models API requests through Salesforce Einstein instead of Anthropic directly
- **Model picker** — choose from Anthropic Claude, OpenAI GPT, Google Gemini, Amazon Titan, and NVIDIA models when Trust Layer is active
- **Agentforce mode** — full Agentforce chat provider with streaming response support and bypassUser retry
- **5-field brand palette** — Accent, Paper, Text, Header Background, Header Text with automatic light/dark adaptation
- **Brand extraction** — extract palette, logo, and fonts from any company URL
- **Generative UI** — provider-independent render layer supports structured UI cards in chat responses
- **FSC on Core support** — uses standard `FinancialAccount` and `FinancialAccountParty` objects; no managed package required
- **Financial Accounts section** — account detail includes holdings, balance, and party role data

## Architecture

The project has two main tiers:

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js Dashboard (React frontend + API routes)            │
│                                                             │
│  Dashboard | Account Detail | AI Panel | Settings           │
│      ↓              ↓             ↓           ↓             │
│  ─────────────────────────────────────────────────────────  │
│  API Routes (server-side)                                   │
│  ─────────────────────────────────────────────────────────  │
│    ↓               ↓              ↓             ↓           │
│  Salesforce    Custom MCP    Anthropic       Salesforce      │
│  REST API      Server        Claude API      Agentforce /    │
│  (page data)   (stdio)                       Models API      │
└─────────────────────────────────────────────────────────────┘
                     ↑
        salesforce-mcp-server/ (separate Node.js process)
```

**Data access is two-consumer:** REST (server-side) for page rendering and KPI data. MCP for AI chat. These are separate auth flows with separate External Client Apps.

### Four External Client Apps required

| ECA | Auth flow | Purpose |
|-----|-----------|---------|
| **Dashboard** | Authorization Code + PKCE | User-facing OAuth login, Salesforce REST API |
| **MCP Server** | JWT Bearer | `salesforce-mcp-server` → Salesforce (headless) |
| **Agentforce** | Client Credentials | Dashboard → Agentforce API |
| **Models API (Trust Layer)** | Client Credentials | Dashboard → Salesforce Models API |

The Hosted MCP provider uses an optional fifth ECA if your org requires a separate OAuth client for the hosted MCP endpoint.

### MCP server

The custom MCP server exposes 19 tools and 4 resources:

**Tools:** `sf_list_accounts`, `sf_get_account`, `sf_get_contacts`, `sf_get_opportunities`, `sf_get_cases`, `sf_get_tasks`, `sf_get_recent_activity`, `sf_get_news_alerts`, `sf_get_pipeline_summary`, `sf_get_client_summary`, `sf_get_financial_accounts`, `sf_get_financial_account_roles`, `sf_get_financial_holdings`, `sf_get_assets_liabilities`, `sf_get_account_relationships`, `sf_search_records`, `sf_run_soql`, `sf_log_activity`, `sf_create_task`, `sf_update_record`, `sf_create_record`, `create_mortgage_opportunity`, `ask_agentforce`

**Resources:** `salesforce://accounts`, `salesforce://pipeline`, `salesforce://user`, `salesforce://account/{id}`

## Prerequisites

- Node.js 20 or higher
- A Salesforce org with **Financial Services Cloud on Core** (standard objects: `FinancialAccount`, `FinancialAccountParty`, `AccountAccountRelation`). FSC managed package (the `FinServ__` namespace) is not supported.
- Four External Client Apps configured in Salesforce Setup (see Setup steps below)
- An Anthropic API key (required for Local MCP and Hosted MCP modes; not required for Trust Layer or Agentforce modes)

## Setup steps

### 1. Clone the repository

```bash
git clone https://github.com/indymba-github/h360-sf-react-claude-app.git
cd h360-sf-react-claude-app
```

### 2. Install dependencies

```bash
cd dashboard && npm install
cd ../salesforce-mcp-server && npm install
```

### 3. Configure the dashboard environment

```bash
cd dashboard
cp .env.example .env.local
```

Edit `.env.local` with your values. The required variables at minimum are:
- `SF_CLIENT_ID` and `SF_CLIENT_SECRET` — from the Dashboard ECA
- `SF_LOGIN_URL` — your org's login URL
- `SF_CALLBACK_URL` — `http://localhost:3000/api/auth/callback`
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `SESSION_SECRET` — generate with `openssl rand -hex 32`

### 4. Configure the MCP server environment

```bash
cd salesforce-mcp-server
cp .env.example .env
```

Edit `.env` with your values:
- `SF_CLIENT_ID` — Consumer Key from the MCP Server ECA
- `SF_USERNAME` — the Salesforce username the JWT will authenticate as
- `SF_LOGIN_URL` — your org's login URL

### 5. Generate the JWT certificate for the MCP server

```bash
cd salesforce-mcp-server
./scripts/generate-cert.sh
```

Upload `server.crt` to your MCP Server External Client App in Salesforce Setup (App Manager → your app → OAuth Settings → Digital Signature).

### 6. Build the MCP server

```bash
cd salesforce-mcp-server
npm run build
```

### 7. Create External Client Apps in Salesforce

For each of the four ECAs listed in the Architecture section, create a Connected App (Setup → App Manager → New External Client App). Scopes, callback URLs, and flow types:

| ECA | Flow | Callback | Scopes |
|-----|------|----------|--------|
| Dashboard | Auth Code + PKCE | `https://YOUR-ORG.my.salesforce.com/services/oauth2/callback` and `http://localhost:3000/api/auth/callback` | `api`, `refresh_token`, `offline_access` |
| MCP Server | JWT Bearer | *(none)* | `api`, `refresh_token` |
| Agentforce | Client Credentials | *(none)* | `api`, `sfap_api` |
| Models API | Client Credentials | *(none)* | `api`, `sfap_api` |

See `docs/SALESFORCE_SETUP.md` for detailed screenshots and permission set requirements.

### 8. Start the development server

```bash
cd dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click "Connect to Salesforce".

## Environment variables

### Dashboard (`dashboard/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SF_CLIENT_ID` | Yes | Consumer Key from the Dashboard External Client App |
| `SF_CLIENT_SECRET` | Yes | Consumer Secret from the Dashboard External Client App |
| `SF_LOGIN_URL` | Yes | `https://YOUR-ORG.my.salesforce.com` (or `https://test.salesforce.com` for sandboxes) |
| `SF_CALLBACK_URL` | Yes | `http://localhost:3000/api/auth/callback` for local development |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key. Required for Local MCP and Hosted MCP modes. Not needed for Trust Layer or Agentforce. |
| `SESSION_SECRET` | Yes | Random 32-byte hex string. Generate with `openssl rand -hex 32`. |
| `LOCAL_MCP_ENABLED` | No | Set to `false` to hide the Local MCP provider. Defaults to `true`. |
| `SF_MCP_SERVER_URL` | No | Salesforce-hosted MCP endpoint URL. Leave blank to hide the Hosted provider. |
| `SF_MCP_CLIENT_ID` | No | OAuth client ID if the hosted MCP endpoint requires separate credentials. |
| `SF_MCP_CALLBACK_URL` | No | OAuth callback URL for the hosted MCP endpoint. |
| `SF_MODELS_CLIENT_ID` | No | Consumer Key for the Models API (Trust Layer) External Client App. Required to enable Trust Layer mode. |
| `SF_MODELS_CLIENT_SECRET` | No | Consumer Secret for the Models API ECA. |
| `SF_MODELS_DEFAULT_MODEL` | No | Override the default Trust Layer model. Defaults to `sfdc_ai__DefaultBedrockAnthropicClaude46Sonnet`. |
| `SF_AGENT_CLIENT_ID` | No | Consumer Key for the Agentforce External Client App. Required to enable Agentforce mode. |
| `SF_AGENT_CLIENT_SECRET` | No | Consumer Secret for the Agentforce ECA. |
| `SF_AGENT_ID` | No | Default Agentforce agent ID. Seeds the first agent profile in Settings. |
| `SF_AGENTFORCE_CONSULT_AGENT_ID` | No | Agent ID used by the "Consult Agentforce" tool in Claude mode. Defaults to `SF_AGENT_ID`. |
| `MCP_SERVER_PATH` | No | Absolute path to `salesforce-mcp-server/dist/index.js`. Defaults to the sibling `salesforce-mcp-server/`. |
| `AGENTFORCE_DEBUG` | No | Set to `true` to log raw Agentforce API responses. |

### MCP server (`salesforce-mcp-server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SF_LOGIN_URL` | Yes | `https://YOUR-ORG.my.salesforce.com` |
| `SF_CLIENT_ID` | Yes | Consumer Key from the MCP Server External Client App |
| `SF_USERNAME` | Yes | Salesforce username the JWT will authenticate as |
| `SF_PRIVATE_KEY_PATH` | Yes | Path to the RSA private key (default: `./server.key`) |
| `SF_TOKEN_LIFETIME_MINUTES` | No | Token refresh threshold in minutes. Defaults to 55. |
| `DASHBOARD_URL` | No | URL of the running dashboard (for the `ask_agentforce` MCP tool callback). Defaults to `http://localhost:3001`. |
| `SHARED_MCP_TOKEN` | No | Shared bearer token for dashboard API auth used by the `ask_agentforce` tool. |

All values must be placeholders until you replace them. Never commit `.env` or `.env.local`.

## Project structure

```
h360-sf-react-claude-app/
├── dashboard/                    Next.js application
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/             OAuth login and callback
│   │   │   ├── chat/             AI chat (Local MCP, Hosted MCP, Trust Layer)
│   │   │   ├── agent/            Agentforce chat
│   │   │   ├── agentforce/       Account briefing, prompts executor
│   │   │   ├── agentforce-consult/ Consult tool bridge for MCP → Agentforce
│   │   │   ├── financial-accounts/ Financial account balance and transactions
│   │   │   └── settings/         Persist app settings
│   │   └── (pages)/
│   ├── components/               React components
│   └── lib/
│       ├── salesforce.ts         Salesforce REST API helpers
│       ├── agentforce-types.ts   Response parsing (Inform / Inquire / aggregates)
│       ├── agentforce-client.ts  Agentforce API client
│       ├── trust-layer-context.ts Salesforce Models API client
│       ├── salesforce-models-catalog.ts Available Trust Layer models
│       ├── brandColors.ts        Palette derivation and extraction
│       ├── demoPacks.ts          Brand preset definitions
│       └── render-registry.tsx   Generative UI component registry
├── salesforce-mcp-server/        Standalone MCP server (stdio transport)
│   ├── src/tools/                19 MCP tool implementations
│   └── scripts/generate-cert.sh RSA key pair generator
└── docs/                         Setup, customization, and troubleshooting guides
```

## Documentation

- `docs/SALESFORCE_SETUP.md` — End-to-end Salesforce org configuration, ECA setup, permission sets
- `docs/CUSTOMIZATION.md` — Brand palette, AI providers, Generative UI components, adding MCP tools
- `docs/TROUBLESHOOTING.md` — Common errors and resolutions

## License

MIT. See `LICENSE`.
