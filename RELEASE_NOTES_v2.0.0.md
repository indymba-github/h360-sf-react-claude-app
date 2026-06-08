# v2.0.0 Release Notes

## Major Additions Since v1

### New AI Modes

- **Hosted MCP** — Connects Claude to a Salesforce-managed MCP endpoint scoped to the logged-in user's session. No separate server process to manage; data access stays within Salesforce's runtime.
- **Agentforce mode** — Full Agentforce chat provider with streaming response support, bypassUser retry on 400 errors, and Agentforce render marker support for generative UI responses. All requests are governed by Salesforce Trust Layer.
- **Trust Layer toggle** — Routes Models API requests through Salesforce Einstein instead of Anthropic directly. Fetches a Client Credentials token from Salesforce and calls `api.salesforce.com/einstein/platform/v1/models/*/generations`.
- **Model picker** — When Trust Layer is active, select from Anthropic Claude, OpenAI GPT, Google Gemini, Amazon Titan, and NVIDIA models from the AI panel.

### New Features

- **5-field brand palette** — Accent, Paper, Text, Header Background, and Header Text fields replace the previous 3-field (Accent, Paper, Ink) schema. Auto-migration from v1 palette data is included.
- **Brand extraction** — Extract palette, logo, and fonts from any company URL. Works for Settings → presets and the brand extraction flow.
- **Light/dark mode with palette preservation** — Toggle light and dark mode; the 5-field palette adapts automatically without resetting custom colors.
- **Generative UI** — Provider-independent render layer. Supports structured UI cards inline in chat responses. Ships with two render components: mortgage calculator and Account Risk Briefing.
- **Account context awareness** — Chat panel pre-fetches the current account's data when on an account detail page. The AI has account context without requiring a tool call.
- **Agentforce briefing buttons** — Account detail page includes "Account Risk Briefing" button that routes through Agentforce and renders a structured card.
- **News alerts system** — News Alerts section on account detail with clickable signal cards and a notification bell.
- **Financial Accounts section** — Account detail includes financial accounts, holdings, balance, and financial account party role data backed by FSC on Core standard objects.

### Architecture Changes

- **FSC on Core support** — Data model uses standard Salesforce objects: `FinancialAccount`, `FinancialAccountParty`, and `AccountAccountRelation`. No managed package or `FinServ__` namespace prefix required.
- **Four External Client Apps required** — v1 required one or two ECAs. v2 requires four: Dashboard (Auth Code + PKCE), MCP Server (JWT Bearer), Agentforce (Client Credentials), Models API (Client Credentials).
- **jsforce v62.0 minimum API version** — MCP server uses API version 62.0 to access FSC on Core standard objects.
- **19 MCP tools / 4 MCP resources** — Added `sf_get_financial_accounts`, `sf_get_financial_account_roles`, `sf_get_financial_holdings`, `sf_get_assets_liabilities`, `sf_get_account_relationships`, `ask_agentforce`, and `create_mortgage_opportunity`.

## Setup Requirements

- Node.js 20 or higher (previously 18+)
- Salesforce org with Financial Services Cloud on Core (standard objects, not the managed package)
- Four External Client Apps configured in Salesforce Setup
- Anthropic API key (required for Local MCP and Hosted MCP modes only; not required for Trust Layer or Agentforce)

See the README and `docs/SALESFORCE_SETUP.md` for full setup instructions.

## Breaking Changes

- **New environment variables** — `SF_MODELS_CLIENT_ID`, `SF_MODELS_CLIENT_SECRET`, `SF_MODELS_DEFAULT_MODEL`, `SF_AGENTFORCE_CONSULT_AGENT_ID` added to `dashboard/.env.example`. `DASHBOARD_URL` and `SHARED_MCP_TOKEN` added to `salesforce-mcp-server/.env.example`. Copy the new `.env.example` files and add missing variables to existing deployments.
- **Palette schema migrated from 3 to 5 fields** — The v1 palette used `accent`, `paper`, and `ink`. v2 uses `accent`, `paper`, `text`, `headerBg`, and `headerFg`. Saved palettes from v1 are auto-migrated on first load, with `text` derived from `ink` and `headerBg`/`headerFg` derived from the dark variant of `ink`.
- **FSC managed package no longer supported** — The `FinServ__` namespace is not used. Financial data queries use standard object names without a namespace prefix.

## Known Limitations

- **Salesforce Models API does not support tool use** — The Trust Layer provider cannot make MCP tool calls. When Trust Layer is active, the dashboard pre-fetches account context and includes it in the system prompt instead of relying on live tool calls.
- **Agentforce sub-agent delegation has API limitations** — Complex multi-step queries may trigger a `PlannerException` from the Agentforce API. The bypassUser retry handles one class of these errors; others may require prompt-engineering the agent.
- **News alert generation requires an external scanning agent** — The news alerts section reads from a Salesforce custom object populated by a separate process. Out of the box it renders any records already present in that object; it does not scan external news sources.

## Migration from v1

1. Pull the latest code on `main` or checkout the `release/v2.0.0` branch.
2. Update your `dashboard/.env.local` file: copy new variables from `dashboard/.env.example` and set values for any providers you want to enable (Models API, Agentforce consult).
3. Update your `salesforce-mcp-server/.env` file: add `DASHBOARD_URL` and `SHARED_MCP_TOKEN` from `salesforce-mcp-server/.env.example`.
4. Create three additional External Client Apps in Salesforce Setup: one for Agentforce (Client Credentials), one for Models API (Client Credentials), and optionally one for Hosted MCP.
5. Rebuild the MCP server: `cd salesforce-mcp-server && npm install && npm run build`.
6. Verify your org uses FSC on Core standard objects. If your org uses the `FinServ__` managed package, the financial data queries will not return results — the standard objects must be in place.
7. Restart the dashboard dev server: `cd dashboard && npm run dev`.

No database or storage migration is required. Saved palette settings auto-migrate on first load.
