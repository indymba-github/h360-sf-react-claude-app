# salesforce-mcp-server

An MCP (Model Context Protocol) server that exposes Salesforce CRM data as tools for AI agents. Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [jsforce](https://jsforce.github.io/).

## Authentication

This server uses the **OAuth 2.0 JWT Bearer Token flow** — no user-facing login redirect, no password storage. The server signs a short-lived JWT with your RSA private key; Salesforce verifies the signature against a certificate you uploaded to your Connected App and returns an access token.

---

## Setup

### 1. Generate the RSA key pair

```bash
chmod +x scripts/generate-cert.sh
./scripts/generate-cert.sh
```

This creates two files in the project root:

| File | Purpose |
|---|---|
| `server.key` | Private key — **never commit, never share** |
| `server.crt` | Self-signed certificate — upload to Salesforce |

To generate them manually instead:

```bash
# Generate private key
openssl genrsa -out server.key 2048

# Generate self-signed certificate (valid 10 years)
openssl req -new -x509 \
  -key server.key \
  -out server.crt \
  -days 3650 \
  -subj "/C=US/ST=CA/O=SF MCP Server/CN=salesforce-mcp-jwt"
```

---

### 2. Create a Connected App in Salesforce

1. Go to **Setup → App Manager → New Connected App**
2. Fill in the basics:
   - **Connected App Name**: `SF MCP Server` (or whatever you like)
   - **Contact Email**: your email
3. Under **API (Enable OAuth Settings)**:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `http://localhost` (not used for JWT flow, but required by the form)
   - **Selected OAuth Scopes**: add at minimum:
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - Check **Use digital signatures**
   - Click **Choose File** and upload `server.crt`
4. Save. Salesforce may take 2–10 minutes to activate the Connected App.

---

### 3. Configure OAuth policies

After saving the Connected App:

1. Click **Manage** (or go back to App Manager → find your app → ▼ → Manage)
2. Click **Edit Policies**
3. Under **OAuth Policies**:
   - Set **Permitted Users** to **Admin approved users are pre-authorized**
   - This is required for the JWT Bearer flow — without it, non-admin users get `invalid_grant`
4. Save.

---

### 4. Assign the Connected App to your user via a Permission Set

"Admin approved" means the app must be explicitly assigned. The cleanest way is via a Permission Set:

1. **Setup → Permission Sets → New**
   - Label: `SF MCP Server Access`
   - Save
2. On the Permission Set detail page → **Assigned Connected Apps → Edit**
   - Move `SF MCP Server` to Enabled
   - Save
3. **Setup → Users → [your user] → Permission Set Assignments → Edit Assignments**
   - Add `SF MCP Server Access`
   - Save

Alternatively: **App Manager → [your app] → Manage → Manage Profiles/Permission Sets** and add directly.

---

### 5. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=<Consumer Key from the Connected App>
SF_USERNAME=<your Salesforce username (email)>
SF_PRIVATE_KEY_PATH=./server.key
```

To find the **Consumer Key**: App Manager → your app → View → API (Enable OAuth Settings) → Consumer Key.

> **Sandbox users**: set `SF_LOGIN_URL=https://test.salesforce.com`

---

### 6. Build and run

```bash
npm install
npm run build
node dist/index.js
```

If authentication is configured correctly the server starts silently (stdio transport — it waits for MCP messages).

---

## Token refresh

JWT Bearer access tokens are valid for the duration of your org's **Session Timeout** setting (default: 2 hours; range: 15 min – 12 hours). This server handles expiry two ways:

1. **Proactive refresh** — `getConnection()` tracks when the connection was established and forces a re-authenticate after `SF_TOKEN_LIFETIME_MINUTES` (default: 55 min). Adjust this if your org uses a shorter session timeout:
   ```env
   SF_TOKEN_LIFETIME_MINUTES=14
   ```

2. **Reactive refresh** — jsforce's `refreshFn` fires automatically on `INVALID_SESSION_ID` errors. The server re-signs a new JWT assertion and retries the original request transparently.

---

## Available tools

All tools are read-only (`readOnlyHint: true`) and use the `sf_` prefix.

| Tool | Description |
|---|---|
| `sf_list_accounts` | List accounts with optional industry/rating filters |
| `sf_get_account` | Full detail for a single account by ID |
| `sf_search_records` | SOSL full-text search across Account, Contact, Opportunity, Case |
| `sf_get_opportunities` | Opportunities filtered by account and/or stage |
| `sf_get_contacts` | Contacts filtered by account |
| `sf_get_cases` | Cases filtered by account and/or status |
| `sf_get_pipeline_summary` | Open pipeline aggregated by stage + historical win rate |
| `sf_get_recent_activity` | Most recently modified records across all four objects |
| `sf_run_soql` | Execute a read-only `SELECT` query (DML is rejected) |

---

## Using with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "node",
      "args": ["/absolute/path/to/salesforce-mcp-server/dist/index.js"]
    }
  }
}
```

## Using with Claude Code (this CLI)

```bash
claude mcp add salesforce node /absolute/path/to/salesforce-mcp-server/dist/index.js
```

---

## Inspecting with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens at `http://localhost:6274`. The server will authenticate to Salesforce on the first tool call.
