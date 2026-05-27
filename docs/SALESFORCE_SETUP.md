# Salesforce Setup

End-to-end guide for configuring your Salesforce org to work with this app. Allow 30–60 minutes for first-time setup. Most of the work is in Salesforce, not in code.

This guide assumes you have admin access to a Salesforce org. If you don't, get a free Developer Edition org at [developer.salesforce.com](https://developer.salesforce.com/signup).

## Overview

The app needs three Salesforce-side things to work fully:

1. **OAuth credentials** for the dashboard to log users in and call Salesforce APIs (required)
2. **A JWT-signed External Client App** for the local MCP server (required for Local mode)
3. **Agentforce configuration** if you want to use Agentforce as a reasoning provider (optional)

The recommended setup uses **three separate External Client Apps**, one per purpose. You can technically combine them, but the OAuth scope requirements conflict — see the architecture note at the end.

## Step 1 — Create the dashboard's External Client App

This app handles user login (OAuth 2.0 Authorization Code flow) and authorizes API calls on the user's behalf.

1. In Salesforce: **Setup → App Manager → New External Client App**
2. Fill in:
   - **External Client App Name:** `H360 Dashboard`
   - **API Name:** `H360_Dashboard`
   - **Contact Email:** your email
3. Click **Save and Continue**, then go to **Policies → OAuth Settings → Edit**
4. Enable OAuth and configure:
   - **Callback URL:** `http://localhost:3000/api/auth/callback`
   - **OAuth Scopes:**
     - `Full access (full)`
     - `Perform requests at any time (refresh_token, offline_access)`
   - **Require PKCE Verification for Supported Authorization Flows:** Enabled
5. Save
6. Wait 2–10 minutes for Salesforce to provision the app (it does this asynchronously)
7. Go to **Settings → OAuth Settings** and copy:
   - **Consumer Key** → put in `.env.local` as `SF_CLIENT_ID`
   - **Consumer Secret** → put in `.env.local` as `SF_CLIENT_SECRET`

### Note on External Client Apps vs. legacy Connected Apps

Salesforce has two generations of OAuth app management. External Client Apps (newer, recommended) live under **App Manager**. Legacy Connected Apps live under **Build → Create → Apps**. The instructions above use the newer External Client App. The terminology, layout, and field names differ slightly from any guides written before 2024.

## Step 2 — Set up the local MCP server

The local MCP server uses **JWT Bearer authentication** — no user login, no stored passwords. The server authenticates as itself using a signed certificate. Each tool call still runs as the logged-in user when invoked from the dashboard (the user's access token is passed through).

### Generate the certificate

The MCP server needs a self-signed certificate. A script is included:

```bash
cd salesforce-mcp-server
./scripts/generate-cert.sh
```

This creates `server.key` (private key) and `server.crt` (public certificate). Never commit these. Both should already be in `.gitignore`.

### Configure the External Client App for JWT

You can either reuse the dashboard's External Client App (Step 1) or create a second one. Reusing the same app is simpler; using a separate one keeps the JWT-signed surface isolated.

To enable JWT on the External Client App:

1. **Setup → App Manager → your app → Edit**
2. Open **Policies → OAuth Settings → Edit**
3. Under **Flow Enablement**, check **Enable JWT Bearer Flow**
4. Under **Digital Signature**, upload `server.crt` from the previous step
5. Save

The Consumer Key in this app is what goes in `salesforce-mcp-server/.env` as `SF_CLIENT_ID`.

### Pre-authorize users

JWT Bearer requires the user to be pre-authorized for the app:

1. On the External Client App, **Policies → OAuth Policies**
2. Set **Permitted Users** to **Admin approved users are pre-authorized**
3. Save

### Create and assign a Permission Set

1. **Setup → Permission Sets → New**
2. Name it `H360 App User` (or similar)
3. Save
4. In the Permission Set: **Apps → Assigned Apps → Edit** — add your External Client App
5. Save
6. Back at the Permission Set: **Manage Assignments → Add Assignments** — assign yourself (and any other users who should use the app)

### Configure the MCP server's environment

In `salesforce-mcp-server/.env`:


SF_CLIENT_ID=<dashboard External Client App Consumer Key>
SF_CLIENT_SECRET=<dashboard External Client App Consumer Secret>
SF_LOGIN_URL=https://YOUR-ORG.my.salesforce.com
SF_CALLBACK_URL=http://localhost:3000/api/auth/callback
ANTHROPIC_API_KEY=sk-ant-...
SESSION_SECRET=<random 32-char hex from openssl rand -hex 32>
Hosted MCP (optional)
SF_MCP_SERVER_URL=
Agentforce (optional)
SF_AGENT_CLIENT_ID=<Agentforce External Client App Consumer Key>
SF_AGENT_CLIENT_SECRET=<Agentforce External Client App Consumer Secret>
SF_AGENT_ID=<Agent ID, starts with 0Xx>
Debug (optional)
AGENTFORCE_DEBUG=false

## Migrating between orgs

Each org has its own External Client Apps, JWT certificate, and Agentforce configuration. When migrating:

1. Repeat Steps 1–3 in the new org from scratch
2. Generate a new JWT certificate (or upload your existing `server.crt` to the new org's External Client App)
3. Replace the env values in both `.env.local` and `salesforce-mcp-server/.env`
4. Clear browser cookies and localStorage for `localhost:3000` (otherwise the old session may persist with the old org's `instanceUrl`)
5. Restart the dev server

Cross-org session leakage causes one of the most confusing failure modes: hardcoded "View in Salesforce" links pointing at the old org, "Connected App not found" errors despite the app existing in the new org. The fix is always a full browser storage clear followed by a fresh OAuth login.

### Verification sequence

After migration, work through this sequence in order. Each step builds on the previous and reveals problems early:

1. **Build MCP server, test with Inspector.**
```bash
   cd salesforce-mcp-server
   npm run build
   npx @modelcontextprotocol/inspector node dist/index.js
```
   Call `sf_list_accounts` from the Inspector. If this fails, JWT auth or Permission Set assignment is wrong. Don't proceed until this works.

2. **Start the dashboard, sign in.** Confirm OAuth flow completes and the dashboard loads with account data. If the dashboard renders but shows no data, RBAC or scopes are likely the issue.

3. **Test Local mode in the AI panel.** Ask a simple question that requires data retrieval (e.g., "List my top 5 accounts by revenue"). Confirm Claude calls tools and returns real data.

4. **Sign out, reconnect Hosted MCP, test Hosted mode.** This requires re-authorizing the Hosted MCP External Client App on the new org. If Hosted shows as "Configured" but tool calls fail, verify `api.salesforce.com` connectivity from your environment.

5. **Test Agentforce mode.** Ask the same simple question. If you get a generic acknowledgment without data, the agent's topics need configuration. If you get a 412 "Invalid Config" error, the agent isn't deployed/active. If you get 404 "No valid version available", you're hitting the trial-org limitation (see TROUBLESHOOTING.md).

6. **Test briefing buttons on an account detail page.** These route through Agentforce. If Agentforce chat works but briefings fail, the agent doesn't have topics configured for the specific briefing queries.

7. **Test news alert dismiss.** Find or create a Task with subject "News Alert: [text]" linked to an account. Verify it appears on the dashboard and can be dismissed.

If any step fails, fix it before moving to the next. Failures cascade — the early steps establish foundations the later ones depend on.

### What changes vs. what stays the same

**Org-specific (must change when migrating):**
- All `SF_CLIENT_ID` / `SF_CLIENT_SECRET` pairs (each External Client App has its own)
- `SF_LOGIN_URL` (My Domain URL of the new org)
- `SF_USERNAME` (your user in the new org)
- `SF_AGENT_ID` (Agentforce agents are org-specific)
- `SF_MCP_SERVER_URL` (if using Hosted MCP)

**Org-independent (stays the same):**
- `server.key` and `server.crt` (the JWT cert just gets uploaded to each org)
- `ANTHROPIC_API_KEY`
- `SESSION_SECRET`
- All application code (zero changes)
- `.settings.json` (branding configuration)

## Architecture note: Why three External Client Apps

This setup uses three separate External Client Apps:

1. **Dashboard OAuth** — broad scopes (`full`, `refresh_token`), Authorization Code + PKCE
2. **MCP server JWT** — broad scopes, JWT Bearer flow (can be combined with #1 by enabling both flows on the same app)
3. **Agentforce** — narrow scopes (`sfap_api`, `api`), Client Credentials flow

The split exists because Agentforce's token endpoint rejects broad scopes. You can technically use one app for #1 and #2 (enable JWT Bearer on the dashboard app), but Agentforce requires its own dedicated app.

If you have a single environment and a single user, the minimum is two apps — dashboard+JWT combined, plus Agentforce. The three-app setup adds clarity and isolates each concern.