# Customization

How to extend the codebase: adding MCP tools, modifying components, configuring AI providers via environment variables, and customizing the chat experience.

For UI-level customization (branding, presets, prompts, theme, choosing AI providers), see `SETTINGS.md` — that's where most day-to-day customization happens through the app's Settings page.

This document covers the deeper code-level changes.

## AI provider configuration via environment variables

The Settings page auto-detects which AI providers are available based on environment variables in `.env.local`. To enable a provider, set its env vars and restart the dev server.

| Provider | Required env vars | Behavior |
|---|---|---|
| Local | `LOCAL_MCP_ENABLED` is unset or `true`, and the MCP server is built | Spawns the custom MCP server in `salesforce-mcp-server/` as a child process |
| Hosted | `SF_MCP_SERVER_URL` set to a valid Salesforce-hosted MCP endpoint | Connects via StreamableHTTPClientTransport |
| Agentforce | `SF_AGENT_CLIENT_ID` and `SF_AGENT_CLIENT_SECRET` set | Routes chat through Agentforce Agent API via Client Credentials |

Important: Next.js caches environment variables on startup. Changes to `.env.local` require a dev server restart (`Ctrl+C`, then `npm run dev`).

Once env vars are set, the Settings page (Section 08 — AI provider) shows the provider as "Configured" and exposes it in the AI panel's provider toggle.

## Managing Agentforce agents

The Agentforce provider supports multiple saved agent profiles. The first profile seeds from the `SF_AGENT_ID` env var on first run; additional profiles can be created from the Settings page.

For day-to-day use:

- **Add or edit agents:** Settings → AI provider → Manage agents
- **Switch the active agent:** AI Assistant panel header (not Settings — this is intentional)
- **Switch mid-conversation:** The current Agentforce session ends silently; the next message starts a fresh session with the new agent

Profiles live in browser localStorage. They do not sync across devices and are not committed to the repo.

Implementation lives in `dashboard/lib/agents.ts`.

## Adding tools to the local MCP server

The local MCP server (`salesforce-mcp-server/`) exposes Salesforce data and operations as MCP tools. Tools live in `salesforce-mcp-server/src/tools/`, one file per topic.

To add a new tool:

1. Create a new file in `salesforce-mcp-server/src/tools/` (e.g., `myTopic.ts`)
2. Use the existing tool pattern (see `accounts.ts` or `cases.ts` for examples):

```typescript
import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { sfFetch } from "../salesforce.js";

export const myCustomTool: Tool = {
  name: "sf_my_custom_query",
  description: "What this tool does — Claude reads this to decide when to call it",
  inputSchema: {
    type: "object",
    properties: {
      accountId: { type: "string", description: "Salesforce Account Id" },
    },
    required: ["accountId"],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function executeMyCustomTool(args: { accountId: string }) {
  const result = await sfFetch(
    `/services/data/v60.0/query?q=SELECT+...`,
    {}
  );
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

3. Register the tool in `salesforce-mcp-server/src/index.ts`:

```typescript
import { myCustomTool, executeMyCustomTool } from "./tools/myTopic.js";

// In the tool list:
const tools = [
  // ... existing tools
  myCustomTool,
];

// In the tool dispatcher:
case "sf_my_custom_query":
  return await executeMyCustomTool(request.params.arguments);
```

4. Rebuild the MCP server:

```bash
cd salesforce-mcp-server
npm run build
```

5. Test with the MCP Inspector before integrating:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

The dashboard picks up the new tool automatically on the next dev server restart.

### Tool design principles

A few patterns the existing tools follow that are worth maintaining:

- **Tool descriptions are prompts.** Claude decides whether to call a tool based on its description. Be specific about what it does, what inputs mean, and when it should be used.
- **Prefer narrow tools over broad ones.** `sf_get_pipeline_summary` is more useful than `sf_run_arbitrary_soql` because Claude doesn't have to guess at the right SOQL.
- **Return structured data, not prose.** Tools should return JSON. Let Claude format the prose response.
- **Annotate tools honestly.** `readOnlyHint: false` and `destructiveHint: true` on any tool that writes. The dashboard surfaces destructive tools differently and Claude will request user approval before invoking.

## Voice input

The AI panel supports push-and-hold voice input via the browser's SpeechRecognition API. Hold the microphone button to record; release to send. The spacebar acts as a shortcut when the input field is focused and empty.

Works in Chrome, Edge, and Safari with no extra configuration. Firefox has limited support. If the mic button doesn't appear, the browser doesn't support SpeechRecognition.

Implementation is in `dashboard/components/MicButton.tsx`.

## Account context awareness

When you're on an account detail page, the AI panel automatically scopes its context to that account. The chat shows "Viewing: [Account Name]" at the top, and pronouns like "her," "his," or "this account" resolve to the current account.

The context is a default, not a constraint. You can still ask about other accounts or the pipeline as a whole — just be explicit in the question.

Context behavior works across all three providers (Local, Hosted, Agentforce). Implementation lives in `dashboard/lib/use-ai-context.tsx`.

## Environment variables reference

### Required

| Variable | Purpose |
|---|---|
| `SF_CLIENT_ID` | Dashboard's External Client App Consumer Key |
| `SF_CLIENT_SECRET` | Dashboard's External Client App Consumer Secret |
| `SF_LOGIN_URL` | Your Salesforce My Domain URL or `login.salesforce.com` |
| `SF_CALLBACK_URL` | OAuth callback URL, usually `http://localhost:3000/api/auth/callback` |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `SESSION_SECRET` | 32+ character random string for cookie encryption |

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `LOCAL_MCP_ENABLED` | `true` | Set to `false` to hide the Local provider |
| `SF_MCP_SERVER_URL` | unset | Enables Hosted MCP when set to a valid Salesforce-hosted MCP endpoint |
| `SF_AGENT_CLIENT_ID` | unset | Agentforce External Client App Consumer Key |
| `SF_AGENT_CLIENT_SECRET` | unset | Agentforce Consumer Secret |
| `SF_AGENT_ID` | unset | Default Agent ID; seeds first agent profile in Settings |
| `AGENTFORCE_DEBUG` | `false` | Set to `true` to log raw Agentforce API responses to the server console |

### MCP server (separate file)

In `salesforce-mcp-server/.env`:

| Variable | Purpose |
|---|---|
| `SF_LOGIN_URL` | Your My Domain URL (NOT `login.salesforce.com` for JWT Bearer) |
| `SF_CLIENT_ID` | JWT-enabled External Client App Consumer Key |
| `SF_USERNAME` | Your Salesforce username |
| `SF_PRIVATE_KEY_PATH` | Path to `server.key` |

## Customizing the dashboard layout

The dashboard sections (KPI cards, Pipeline chart, News alerts, Top accounts, Recent activity, etc.) are defined as separate React components in `dashboard/components/`. To remove a section, comment it out of `dashboard/app/dashboard/page.tsx`. To reorder, move the components around in the JSX.

To customize chart colors, see `dashboard/lib/brandColors.ts` and the CSS variables it defines. Chart palettes resolve from `--color-accent` and the editorial palette tokens (`--color-ink`, `--color-paper`).

## Customizing the AI panel

The AI Assistant panel is defined in `dashboard/components/ChatPanel.tsx`. Common customizations:

- **Prompt chips** — Configurable per-page from the Settings page (Section 07 — Prompts library). The chip data is stored in browser localStorage; the panel reads from there.
- **Tool visualization** — The animated "thinking → calling tool → got results" sequence is in `ChatPanel.tsx`'s tool-call handler. Adjust phase labels there.
- **Response rendering** — See `AgentforceResults.tsx` and `AgentforceChoices.tsx` for how Agentforce's structured responses render. The parser in `agentforce-types.ts` is the entry point.

For any changes, restart the dev server. Hot reload works for most changes but tooling/auth paths sometimes need a full restart.

## File map for common customizations

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

## Customizing risk briefing thresholds

The Account Risk Briefing applies the bank's risk policy via deterministic heuristics defined in `dashboard/lib/risk-heuristics.ts`. Editing a threshold changes how the agent assesses risk across all accounts — no model retraining, no code rebuild required beyond a dev server restart.

For the full story (why it's deterministic, what each signal measures, how to customize, demo notes for SE conversations), see `docs/RISK_HEURISTICS.md`.

Quick reference:

| To change... | Edit |
|---|---|
| What counts as a "long engagement gap" | `ENGAGEMENT_HEURISTICS.daysSinceLastActivity` |
| What counts as a "stalled" opportunity | `PIPELINE_HEURISTICS.stalledOppRatio.stalledThresholdDays` |
| How aggressively losses flag pipeline risk | `PIPELINE_HEURISTICS.recentLossVolume.lookbackDays` |
| Whether single-contact accounts flag as risk | `ENGAGEMENT_HEURISTICS.contactCount.lowMin` |

Edit `dashboard/lib/risk-heuristics.ts`, restart the dashboard, ask the AI Assistant for a risk briefing — the new policy is active.