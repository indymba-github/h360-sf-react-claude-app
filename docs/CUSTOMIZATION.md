# Customization

How to configure the app's appearance, AI behavior, and tool inventory after the initial setup is complete.

## Branding

The app's visual identity is fully configurable from Settings. Brand changes take effect immediately and persist in `dashboard/.settings.json` (which is gitignored).

### Brand presets

Settings → **Brand identity** → **Presets** shows a library of saved brand configurations. The repo ships with one preset (Cumulus, a placeholder). Each preset stores a complete brand identity: colors, logo, fonts, border radius, and sidebar style.

Available actions:

- **Apply** — switch the entire app to the selected preset
- **Edit** — modify the preset's colors, logo, and typography in place
- **Duplicate** — copy a preset as a starting point for a new one
- **Delete** — remove a custom preset (the original Cumulus preset cannot be deleted; it can be restored if you accidentally edit it via **Restore seeded presets**)

Presets are stored in browser localStorage, so each user has their own preset library on their own machine. Presets do not sync across devices or get committed to the repo.

### Brand from website

Settings → **Brand identity** → **Brand from website**. Enter a company website URL and the app extracts brand identity automatically:

- **Primary color, secondary color, and additional palette** — extracted from CSS files, style tags, inline styles, and `meta theme-color` tags
- **Logo** — extracted from the most prominent logo image on the page
- **Heading and body fonts** — detected from Google Fonts imports and CSS font-family declarations
- **Visual analysis** — Claude reviews the rendered page to identify and prioritize brand elements

Results appear as a palette below the input. Each color shows the value; clicking opens a popover with "Use as primary," "Use as secondary," and "Use as accent" options. Logo and fonts have similar "Apply" buttons.

You can apply individual elements or click **Apply all** to set everything at once. Either way, the result is editable in the Palette and Typography sections below.

### Palette

Color tokens for the app:

- **Primary** — the main brand color, used for buttons, links, and chart accents
- **Secondary** — used sparingly for distinction (selected states, accent gradients)
- **Accent** — used for callouts, hover states, brass-style ornament

Each color has a hex input and a swatch you can click to open a color picker. Changes take effect immediately.

In dark mode, brand colors are automatically lifted (HSL adjustment) for text on dark backgrounds while paint surfaces (chart bars, buttons) keep the original brand hue. You don't need to set separate dark-mode colors.

### Typography

- **Heading font** — used for page titles and section headers
- **Body font** — used for everything else

Both are selected from a curated list of Google Fonts. The font files load automatically when applied.

### Border radius

A slider from 0 (sharp corners) to 16 (very rounded) controls the corner radius on cards, buttons, badges, and panels app-wide.

### Sidebar style

Toggle between **Dark sidebar** (default; cream content area with a dark navigation bar) and **Light sidebar** (uniform light background throughout).

### Theme

Settings → **Theme** offers Light, Dark, or System (follows your OS preference). The current default is Light. Changes affect background, surface, ink (text), and ornament colors. Brand colors adapt automatically.

## AI provider configuration

The AI Assistant panel supports three providers. Settings → **AI provider** shows which providers are configured and how to enable the others.

### Auto-detection

The app determines provider availability from environment variables at server startup, not from user-facing toggles. The Settings panel reads `/api/config/providers` to display the current state.

A provider shows as **Configured** when its required env vars are set:

| Provider | Required env vars |
|---|---|
| Local | `LOCAL_MCP_ENABLED` is unset or `true` (default), and the MCP server has been built |
| Hosted | `SF_MCP_SERVER_URL` is set |
| Agentforce | `SF_AGENT_CLIENT_ID` and `SF_AGENT_CLIENT_SECRET` are set |

If you change env vars, **restart the dev server** — Next.js caches environment variables on startup.

### Managing Agentforce agents

When Agentforce is configured, Settings → **AI provider** → **Agentforce** → **Manage agents** opens the agent profile editor.

You can save multiple Agentforce agent profiles, each with:

- A display label (e.g., "Sales Demo Agent")
- The Salesforce Agent ID
- An optional description

The first profile is seeded automatically from your `SF_AGENT_ID` env var when set. After that, profiles are stored in browser localStorage. Editing the default profile's Agent ID overrides the env value for your session.

To switch between agents during work, use the picker in the **AI Assistant panel** (below the provider toggle when Agentforce is selected). The Settings page is for setup; the AI panel is for in-the-moment switching.

When you switch agents mid-conversation, the current Agentforce session is silently ended. Your next message starts a fresh session with the new agent.

### Switching providers

The provider toggle in the AI panel (`Local | Hosted | Agentforce`) selects which provider handles new messages. Switching providers preserves the conversation history but does not migrate state — each provider has its own session model.

Recommended provider per task:

- **Local** — exploratory queries, ad-hoc questions, cross-object joins, write operations through your custom tools
- **Hosted** — standard CRM queries when you want data to stay inside Salesforce's runtime
- **Agentforce** — Topic-routed conversations where Trust Layer governance and Agentforce's built-in capabilities are required

## Adding tools to the local MCP server

The local MCP server (`salesforce-mcp-server/`) exposes Salesforce data and operations as MCP tools. To add new tools:

1. Create a new file in `salesforce-mcp-server/src/tools/` (e.g., `myTopic.ts`)
2. Use the existing tool pattern:

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

3. Register it in `salesforce-mcp-server/src/index.ts`:

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
- **Annotate tools honestly.** `readOnlyHint: false` and `destructiveHint: true` on any tool that writes. The dashboard surfaces destructive tools differently.

## Voice input

The AI panel supports push-and-hold voice input via the browser's SpeechRecognition API. Hold the microphone button to record; release to send. The spacebar acts as a shortcut when the input field is focused and empty.

This works in Chrome, Edge, and Safari with no extra configuration. Firefox has limited support. If the mic button doesn't appear, the browser doesn't support SpeechRecognition.

## Account context

When you're on an account detail page, the AI panel automatically scopes its context to that account. The chat shows "Viewing: [Account Name]" at the top, and pronouns like "her," "his," or "this account" resolve to the current account in your message to the AI.

The context is a default, not a constraint. You can still ask about other accounts or the pipeline as a whole — just be explicit in the question.

Context behavior works across all three providers (Local, Hosted, Agentforce).

## Environment variables reference

A complete list of environment variables and their effects. See `.env.example` in both `dashboard/` and `salesforce-mcp-server/` for the templates.

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

The dashboard sections (KPI cards, Pipeline chart, News alerts, Top accounts, Recent activity) are defined as separate React components in `dashboard/components/`. To remove a section, comment it out of `dashboard/app/dashboard/page.tsx`. To reorder, move the components around in the JSX.

To customize the chart colors, see `dashboard/lib/brandColors.ts` and the CSS variables it defines. Chart palettes resolve from `--color-accent`, `--color-warning`, and the editorial palette tokens.

## Customizing the AI panel

The AI Assistant panel is defined in `dashboard/components/ChatPanel.tsx`. Major customizations:

- **Prompt chips** — the suggested prompt buttons below the chat header are defined in `defaultChips` near the top of the file. Add, remove, or reorder.
- **Tool visualization** — the animated "thinking → calling tool → got results" sequence is in the same file's tool-call handler. Adjust phase labels there.
- **Response rendering** — see `AgentforceResults.tsx` and `AgentforceChoices.tsx` for how Agentforce's structured responses render. The parser in `agentforce-types.ts` is the entry point.

For any changes, restart the dev server. Hot reload works for most changes but tooling/auth paths sometimes need a full restart.