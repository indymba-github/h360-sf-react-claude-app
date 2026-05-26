# Troubleshooting

Common errors and how to resolve them. Errors are grouped by where they surface (browser UI, dev server terminal, Salesforce side) so you can find the relevant section quickly.

If you don't see your issue here, open the browser dev console and the `npm run dev` terminal simultaneously. Most failures produce information in one or the other.

## Authentication and OAuth

### "OAuth login fails" / blank page after Salesforce login

**Symptom:** Click "Connect to Salesforce," log in, get redirected to a blank page or an error from your dev server.

**Cause:** The callback URL configured in the External Client App doesn't match `SF_CALLBACK_URL` in `.env.local`. Salesforce is strict — even trailing slashes matter.

**Fix:** In Salesforce, open your External Client App → Policies → OAuth Settings → Callback URL. Confirm it matches exactly:
http://localhost:3000/api/auth/callback

Save. Wait 2–10 minutes for Salesforce to propagate the change. Retry login.

### "Connected App not found" after migrating to a new org

**Symptom:** OAuth login redirects to a Salesforce error: "App not found" or "Connected app does not exist."

**Cause:** Your browser cookies and localStorage still reference the old org's `instanceUrl`, even though your env vars now point at the new org's Consumer Key.

**Fix:**

1. Open browser dev tools → Application tab
2. Storage → Clear site data for `localhost:3000`
3. Stop the dev server (Ctrl+C in the terminal)
4. Delete `.next/` in the dashboard directory: `rm -rf dashboard/.next`
5. Restart `npm run dev`
6. Try OAuth again — should now correctly hit the new org

### "Hardcoded SF links point to old org" after migration

**Symptom:** "View in Salesforce" links on account/contact cards open URLs from your previous org.

**Cause:** Same as above — session state cached the old `instanceUrl`. The current login session is still partially using old-org data.

**Fix:** Same browser storage clear + dev server restart as the previous fix.

## Local MCP server

### "Cannot POST /register" in MCP Inspector

**Symptom:** Running the Inspector against the MCP server produces "Cannot POST /register" in the browser console.

**Cause:** The MCP server is using HTTP transport, but the Inspector requires stdio transport for local debugging.

**Fix:** Verify `salesforce-mcp-server/src/index.ts` uses `StdioServerTransport`, not an HTTP transport. The default in this repo is stdio. If you've modified it, switch back.

### "MCP server fails to start" / no tools visible in Inspector

**Symptom:** Running `node dist/index.js` exits immediately, or the Inspector connects but shows zero tools.

**Cause:** Either the MCP server build hasn't run, or JWT authentication is failing.

**Fix:**

1. Build first: `cd salesforce-mcp-server && npm run build`
2. Run directly with verbose errors: `node dist/index.js` — look for the JWT auth error in stdout
3. Common JWT failure causes:
   - `server.crt` not uploaded to the External Client App in Salesforce
   - `SF_CLIENT_ID` in MCP env doesn't match the JWT-enabled External Client App
   - User specified in `SF_USERNAME` not assigned to the Permission Set for the app
   - User not pre-authorized via "Admin approved users are pre-authorized"

### "SOAP API login is disabled" error

**Symptom:** MCP server logs include `INVALID_LOGIN: SOAP API login() is disabled`.

**Cause:** You're using legacy username-password authentication in an org where it's disabled (default for newer orgs).

**Fix:** Switch to JWT Bearer flow following `docs/SALESFORCE_SETUP.md` → Step 2. Don't use username-password auth.

### "Don't run MCP Inspector and dashboard simultaneously"

**Symptom:** Tool calls fail when the Inspector is open in another window.

**Cause:** Both processes try to spawn the MCP server independently, causing conflicts.

**Fix:** Stop the dashboard before running the Inspector. They can't both be active at once.

## SOQL / data errors

### "No such column 'Rating'" or similar field errors

**Symptom:** Pages render with errors, or the AI panel returns SOQL parse errors mentioning a missing field.

**Cause:** Not all Salesforce orgs have all standard fields. `Account.Rating`, `LastStageChangeDate`, and other fields may exist in some orgs and not others depending on the org type, edition, and customization history.

**Fix:** Edit the SOQL in `lib/salesforce.ts` (for the dashboard) or the relevant tool file in `salesforce-mcp-server/src/tools/` (for MCP tools). Remove the missing field from the query.

In future versions, this could be made dynamic via `Schema.sObjectType.Account.fields.getMap()`. For now, hardcode the fix.

### "Different stage names than expected" in pipeline charts

**Symptom:** The pipeline chart in the dashboard shows different stage names than the screenshots, or some stages are missing entirely.

**Cause:** Opportunity stages are org-specific. Your dev org may use the default (`Prospecting`, `Qualification`, `Needs Analysis`, etc.) while a different org may use customized stages.

**Fix:** This is expected behavior — the chart populates from whatever stages exist in the org. If you want consistent demo screenshots, ensure your dev org uses a known set of stage names.

## Agentforce

### "Failed to start agent session (400): too many scopes requested"

**Symptom:** The AI panel shows this error when Agentforce is selected, even though the External Client App exists in your org.

**Cause:** The OAuth scopes on the External Client App for Agentforce are too broad. Agentforce's token endpoint (`api.salesforce.com`) requires narrow scopes — typically just `sfap_api` and `api`. Broad scopes like `full`, `web`, `openid` cause the token request to fail.

**Fix:** In Salesforce, open the External Client App used for Agentforce (`SF_AGENT_CLIENT_ID`). Edit OAuth Scopes. Remove all scopes except:

- `Manage Agentforce API requests (sfap_api)`
- `Access the Salesforce API Platform (api)`

Save. Wait 2–10 minutes. Restart the dev server. Retry.

If you're using a single External Client App for both the dashboard's user-facing OAuth AND Agentforce, split into two apps. The dashboard needs broad scopes (`full`, `refresh_token`); Agentforce needs narrow scopes. See `docs/SALESFORCE_SETUP.md` → Step 3.

### "Failed to start agent session (404): No valid version available"

**Symptom:** A specific Agentforce agent returns 404 from `api.salesforce.com`, even though the agent appears active in Setup → Agentforce → Agents.

**Cause:** This is a Salesforce-side limitation specific to **trial orgs**. The SFAP (Salesforce AI Platform) runtime layer at `api.salesforce.com` doesn't always register custom `InternalCopilot` agents from trial/playground orgs the same way it does in licensed Agentforce orgs.

What this means in practice:
- Default agents (those that came pre-provisioned in your org) typically work
- Custom agents you create may return 404 even after deployment
- Agentforce Vibes (the in-Salesforce test chat) may still work — but external API access is separately gated
- This is NOT a code or configuration issue in this app

**Fix:**

- For demos, use the default Agentforce agent that came with your org
- For custom agent development, move to a licensed Agentforce org (paid sandbox or production)
- This limitation will likely lift over time as Salesforce expands trial org support

### "Failed to start agent session (412): Unable to load agent config: Invalid Config"

**Symptom:** An agent that you can see in Setup returns 412 when invoked via API.

**Cause:** The agent exists but isn't in a deployable state from the external API's perspective. Possible reasons:

- Agent is in Draft status (not Active/Deployed)
- Agent has no topics configured, or topics are incomplete
- Agent has no LLM/foundation model selected
- Agent is missing a required persona or instructions

Agentforce Vibes (the in-Salesforce test channel) is more permissive than the external API. An agent that works in Vibes may still fail via API if not fully deployed.

**Fix:**

1. Open the agent in Setup → Agentforce → Agents
2. Verify the agent shows as Active/Deployed (not Draft)
3. Compare to a known-working agent's configuration:
   - Topics with valid actions
   - LLM selected
   - Instructions or persona populated
4. Look for a "Deploy" or "Activate" button on the agent detail page; click it if present
5. Save and retry

If side-by-side comparison shows no obvious differences, it may be the trial-org limitation above. Try the same query against your default agent — if that works and the custom one doesn't, the issue is agent-specific.

### "Agentforce returns generic acknowledgments without data"

**Symptom:** You ask "What's our total pipeline?" and Agentforce responds conversationally ("I'd be happy to help with that") without actually fetching data.

**Cause:** Agentforce uses its own Topic configuration to decide when to call which Action. If no Topic matches your query, the agent responds in a generic conversational mode without data retrieval.

**Fix:**

- For ad-hoc queries, use the Local or Hosted MCP providers — they have direct tool access
- To enable data retrieval through Agentforce, configure the relevant Topics in Setup → Agentforce → Agents → your agent → Topics. Each Topic needs:
  - A name and description
  - Instructions ("when to use this topic")
  - At least one Action

This is an Agentforce-side configuration task, not an app configuration task.

### "Truncated Agentforce responses"

**Symptom:** Agentforce responds with a short conversational sentence and seems to stop, even though the prompt should produce data.

**Cause:** Agentforce returns structured data alongside the conversational text. The app handles three patterns:

- **Inform with `result.value.result` as array** — record cards (`AgentforceResults`)
- **Inform with `result.value.result` as string** — HTML summary block
- **Inquire with `collect`** — clickable choice cards (`AgentforceChoices`)

If a response uses a fourth pattern we haven't seen, it falls through and the user sees only the conversational lead-in.

**Fix:**

1. Enable Agentforce debug logging by setting `AGENTFORCE_DEBUG=true` in `.env.local`
2. Restart the dev server
3. Reproduce the truncation
4. Check the `═══ Agentforce raw response ═══` block in your terminal
5. If the response contains data in an unexpected structure, that's a new pattern to handle in `lib/agentforce-types.ts`

Common new patterns to watch for: `result.value` containing markdown, embedded URLs, or nested arrays.

## Provider configuration

### "No AI providers configured" in the AI panel

**Symptom:** AI panel shows an empty state or all three providers as Not Configured.

**Cause:** None of the three providers has all its required env vars set.

**Fix:** At minimum, configure one provider. Quickest path is Local:

1. Ensure `LOCAL_MCP_ENABLED` is unset or `true` in `.env.local`
2. Build the MCP server: `cd salesforce-mcp-server && npm run build`
3. Verify it runs: `node dist/index.js` (should output nothing for ~1 second then idle)
4. Restart the dashboard's dev server
5. Reload the app

For Hosted MCP, set `SF_MCP_SERVER_URL`. For Agentforce, set `SF_AGENT_CLIENT_ID` and `SF_AGENT_CLIENT_SECRET`. See `docs/CUSTOMIZATION.md` for the full reference.

### "Provider shows as Not Configured despite env vars being set"

**Symptom:** You set `SF_MCP_SERVER_URL` or `SF_AGENT_CLIENT_ID` in `.env.local`, but the Settings page still shows "Not configured."

**Cause:** Next.js caches environment variables on startup. Adding env vars to `.env.local` without restarting the dev server has no effect.

**Fix:**

1. Stop the dev server (Ctrl+C)
2. `npm run dev` again
3. Reload the browser

If still not detected, double-check the variable name spelling. Common confusions:

- `SF_MCP_SERVER_URL` ← NOT `SF_HOSTED_MCP_URL`
- `SF_AGENT_CLIENT_ID` / `SF_AGENT_CLIENT_SECRET` ← NOT `AGENTFORCE_ENDPOINT` or other variations

### "Active agent: none" in AI panel

**Symptom:** Agentforce is configured but the AI panel shows no active agent profile.

**Cause:** You have `SF_AGENT_CLIENT_ID` and `SF_AGENT_CLIENT_SECRET` but not `SF_AGENT_ID`, and no agent profiles exist in your browser's localStorage yet.

**Fix:**

- Either: Set `SF_AGENT_ID` in `.env.local`, restart the dev server, and the first agent profile will seed automatically
- Or: Add an agent profile manually via Settings → AI provider → Agentforce → Manage agents

## App state and storage

### "Agent profile reverts to old value after editing"

**Symptom:** You edit an agent profile's Agent ID, save it, and it appears to work — but on the next page load or refresh, the value reverts to the old one.

**Cause:** This was a bug in an earlier version where localStorage's version key wasn't written alongside the data key, causing the next read to re-seed from `SF_AGENT_ID` env. Fixed in current versions.

**Fix:** If you're still seeing this on the current version, clear browser localStorage for `localhost:3000`:

1. Open browser dev tools → Application
2. Storage → Local Storage → http://localhost:3000
3. Delete: `agentforce.profiles`, `agentforce.activeProfileId`, `agentforce.version`
4. Refresh the page
5. The data will re-seed from `SF_AGENT_ID` cleanly

### "Brand colors don't update after editing"

**Symptom:** You change colors in Settings → Palette but the rest of the app doesn't reflect them.

**Cause:** Either the CSS variable isn't being read where you expect, or browser cache is serving stale CSS.

**Fix:**

- Hard refresh the browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- If still wrong, verify the color was actually saved: Settings should show a "Last saved at HH:MM" indicator
- If the color saved but didn't propagate to a specific component, that component may have hardcoded a color. Inspect with browser dev tools and update the component to use `var(--color-accent)` instead.

## Salesforce admin gotchas

### "External Client App not in Permission Sets"

**Symptom:** You try to assign your External Client App to a Permission Set but it doesn't appear in the list.

**Cause:** The app's OAuth Policies require "Admin approved users are pre-authorized" before the app becomes assignable.

**Fix:**

1. Open the External Client App
2. Policies → OAuth Policies
3. Set Permitted Users to "Admin approved users are pre-authorized"
4. Save
5. Now the app appears in Permission Set assignment lists

### "External Client App credential pages return 500 errors"

**Symptom:** Trying to view or rotate the Consumer Secret produces a 500 error in the Salesforce UI.

**Cause:** Known intermittent issue in some org types (trial signups, certain edition transitions).

**Fix:**

- Use the Salesforce CLI: `sf org display --target-org <username>` for some credential info
- For Consumer Secret reset, retry the UI in a fresh browser tab or incognito window
- If persistent, contact Salesforce Support

### "JWT-based access tokens checkbox is required"

**Symptom:** Calls to `api.salesforce.com` (Agentforce, Hosted MCP) fail with auth errors even though normal SF API calls work.

**Cause:** `api.salesforce.com` is the SFAP gateway, which requires JWT-based access tokens. This is a separate setting from JWT Bearer Flow.

**Fix:** On the External Client App used for Agentforce or Hosted MCP:

1. Open the app → Policies → OAuth Settings
2. Check "JWT-based access tokens"
3. Save

This converts normal access tokens into a format `api.salesforce.com` accepts.

## Dev environment

### "Port 3000 already in use"

**Symptom:** `npm run dev` fails with "Error: listen EADDRINUSE: address already in use :::3000"

**Cause:** A previous dev server didn't shut down cleanly, or another app is using the port.

**Fix:**

```bash
# Kill anything on port 3000
lsof -ti:3000 | xargs kill

# Or use a different port
npm run dev -- -p 3001
```

If you use a different port, update `SF_CALLBACK_URL` to match and add the new callback URL to your External Client App in Salesforce.

### "Session cookie not persisting" / login loop

**Symptom:** You log in successfully, get redirected to the dashboard, but you're immediately bounced back to the login page.

**Cause:** `SESSION_SECRET` is missing or invalid in `.env.local`, so the iron-session library can't encrypt/decrypt the cookie.

**Fix:**

1. Generate a new secret: `openssl rand -hex 32`
2. Add to `.env.local`: `SESSION_SECRET=<the output>`
3. Restart the dev server
4. Clear browser cookies for localhost:3000
5. Log in again

### "Chat is slow"

**Symptom:** AI panel responses take 5–15 seconds.

**Cause:** Each tool call (Local or Hosted) makes a round-trip to Salesforce: query construction, network, SOQL execution, response parsing. Typical latency:

- Single SOQL query: 200–500ms
- Pipeline summary (multiple aggregated queries): 1–2s
- Agentforce session start + message: 3–5s

If Claude calls multiple tools to answer one question, latency adds up.

**Fix:**

- Use more specific tools to reduce the number of calls Claude needs
- Profile by enabling `AGENTFORCE_DEBUG=true` to see exact response times for Agentforce
- For Local MCP, the Salesforce API itself is usually the bottleneck — Salesforce orgs have inherent latency floors

If chat takes longer than 30 seconds, that's outside normal range. Check the dev server logs for errors or retry loops.

## General principles

A few things to know that apply across all the categories above:

**Salesforce orgs are not interchangeable.** Field availability, picklist values, Permission Sets, External Client App configurations, and Agentforce setup all vary by org. Code that works in one org may need adjustment for another. If you migrate orgs, expect to revisit this app's config files.

**Browser state survives env changes.** When you change env vars, you usually also need to clear browser cookies and localStorage for localhost:3000 to avoid mixing state between the old and new configurations.

**Restart the dev server after env changes.** Next.js caches env vars at startup.

**Agentforce Vibes is not the API.** Tests passing in Vibes don't guarantee the external API will accept the same query. Vibes is more permissive about agent state, topic completeness, and trial-org limitations.

**SOAP login is disabled in most orgs.** Use OAuth (the dashboard) or JWT Bearer (the MCP server). Don't try username-password authentication.

**Salesforce External Client Apps replace legacy Connected Apps.** If a guide references "Build → Create → Apps → Connected Apps," you're looking at the old UI. Use Setup → App Manager → External Client Apps instead.