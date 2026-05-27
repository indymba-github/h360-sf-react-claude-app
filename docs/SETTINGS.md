# Settings Page Reference

A walkthrough of the Settings page, section by section. The Settings page is where you configure everything user-facing about the app: your name, brand identity, theme, prompt library, and which AI providers power the assistant panel.

All changes save immediately to your browser (most settings) or to a local `.settings.json` file (brand identity). Nothing persists to Salesforce or to any cloud service.

The Settings page is divided into eight numbered sections:

- 00 Profile
- 01 Presets *(Brand Identity)*
- 02 Brand from website *(Brand Identity)*
- 03 App name & logo *(Brand Identity)*
- 04 Palette *(Brand Identity)*
- 05 Typography *(Brand Identity)*
- 06 Theme
- 07 Prompts library
- 08 AI provider

The numbered sections under Brand Identity are grouped together visually under a "BRAND IDENTITY" header, since they're all related to the visual presentation of the app.

## 00 — Profile

A single field: **Full Name**. The name you enter here is used as the display name throughout the app — in the sidebar, in chat history, and in the greeting on the dashboard ("Good morning, [Name]").

This is purely a display value. It does not affect authentication, permissions, or anything sent to Salesforce.

## 01 — Presets

A library of saved brand identity configurations. Each preset captures a complete look: app name, logo, palette colors, fonts. The repo ships with one preset (Cumulus Bank, a fictional bank for demo purposes).

What you can do:

- **Activate a preset** — Click a preset card to instantly apply its full brand identity to the entire app
- **Create a new preset** — Click the "+ New preset" placeholder card to start a custom preset from your current brand settings
- **Edit, duplicate, or delete** — Click the three-dot menu on any preset card
- **Restore default presets** — A link in the lower right of the section restores the seeded presets (Cumulus Bank) if you've accidentally deleted them

Presets are stored in your browser's localStorage, so each user has their own preset library on their own machine. Presets do not sync across devices and do not get committed to the repo.

For demo flows where you switch between multiple customer themes, save each customer's brand as a preset. Then the demo becomes a one-click switch from one customer brand to another.

## 02 — Brand from website

Paste any company website URL and the app extracts brand identity automatically using a combination of CSS parsing and AI vision analysis.

What gets extracted:

- **Colors** — Hex colors from CSS files, style tags, inline styles, and `meta theme-color` tags. Visual analysis identifies which colors are most prominent.
- **Fonts** — Detected from Google Fonts imports and CSS `font-family` declarations
- **Logo** — Most prominent logo image on the page

After extraction, results appear as a palette/preview below the input. Each element has an "Apply" affordance — apply individually or apply everything at once.

This feature is particularly useful for SE demos: paste a prospect's website URL, click Extract, and the app instantly takes on the prospect's visual identity for a custom-branded demo. Pair with Section 01 (Presets) to save the result as a preset for that customer.

## 03 — App name & logo

The app's identity strings, separate from the broader brand identity.

- **App name** — A short text label (12-30 characters). Appears in the sidebar above the navigation and in the browser tab title.
- **Logo** — Upload a PNG, JPG, or SVG (max 200 KB). Appears next to the App name throughout the app.

The Save button only commits the app name. Logo uploads save automatically after selection.

This section's values can be set independently of an active Preset — useful when you want to swap an app name or logo without touching colors or fonts.

## 04 — Palette

The app's three core brand colors:

- **Ink** — The primary text color. Used for headings, body text, and high-emphasis UI. In light mode this is a dark navy; in dark mode it inverts to cream.
- **Paper** — The page background color. Used for the main canvas behind content. In light mode this is a warm cream; in dark mode it inverts.
- **Accent** — The brand color. Used for active states, links, chart highlights, focus rings, and brass-style ornaments. This is the color that most distinguishes one customer brand from another.

Each color has a hex input and a small color swatch. Changes apply immediately as you type or pick.

The "Reset to defaults" link restores the Cumulus Bank palette (deep navy ink, warm cream paper, brass accent).

### Light/dark mode behavior

In dark mode, the Accent color is automatically lifted (HSL-based brightness adjustment) for use as text and small UI ornaments, while paint surfaces like chart bars and primary buttons keep the original Accent hue. You don't need to specify separate dark-mode colors — the app handles the adaptation.

## 05 — Typography

Two font dropdowns:

- **Display (Headlines)** — Used for page titles, large headings, and prominent UI elements. Defaults to Source Serif 4.
- **Body (UI Text)** — Used for body text, buttons, form inputs, and dense UI. Defaults to Inter.

Both dropdowns select from a curated list of Google Fonts. Selected fonts load automatically from Google Fonts CDN.

A live preview below the dropdowns shows how the selected fonts look in context with sample headline and body text. The preview updates as you change selections.

## 06 — Theme

Three appearance options:

- **Light** — Cream paper background, dark ink text. The current default.
- **Dark** — Dark navy paper background, cream ink text. Brand colors adapt automatically.
- **System** — Follows your operating system's appearance preference. Switches between Light and Dark when the OS does.

Changes apply immediately app-wide. Theme preference persists in browser localStorage.

## 07 — Prompts library

Configurable starter prompts that appear as clickable chips above the AI Assistant input on each page. Helps users discover what kinds of questions are useful in each context.

Four tabs, one per page where prompt chips appear:

- **Account Detail** — Default: "Give me a briefing on this account.", "What are the open opportunities for this account?", "Who are the key contacts here?"
- **Dashboard** — Chips that appear on the main dashboard page
- **Accounts List** — Chips on the accounts grid
- **Settings** — Chips on the settings page (typically used for asking the AI about app configuration)

Each prompt is a single-line text string. You can:

- **Reorder** — Drag the handle on the left of any prompt to rearrange
- **Toggle visibility** — Click the eye icon on the right to show/hide a prompt without deleting it
- **Add a new prompt** — Click "+ Add prompt" at the bottom of the tab
- **Edit** — Click any prompt's text to edit inline (depending on implementation)

Prompts are stored in browser localStorage, so each user can customize their own starter prompts independently.

For SE demos, consider tailoring the prompts library per customer scenario. A banking customer might want different starter questions than a manufacturing customer.

## 08 — AI provider

The most operationally significant section. Configures which AI providers power the AI Assistant panel.

### Provider status panel

Three providers, each with a status indicator:

- **Local** — Custom MCP server running on stdio. Configured when the MCP server has been built (`npm run build` in `salesforce-mcp-server/`).
- **Hosted** — Salesforce-hosted MCP server. Configured when `SF_MCP_SERVER_URL` is set in `.env.local`.
- **Agentforce** — Salesforce Agentforce endpoint. Configured when `SF_AGENT_CLIENT_ID` and `SF_AGENT_CLIENT_SECRET` are set in `.env.local`. Includes a **Manage agents** link to add, edit, or delete agent profiles (see below).

Status badges:

- **Configured** — Required env vars are present; provider will appear in the AI panel's provider toggle.
- **Not configured** — Provider is hidden from the AI panel.

If you change env vars, you must **restart the dev server** for the changes to take effect. Next.js caches environment variables at startup.

### Manage agents (Agentforce only)

When Agentforce is configured, the row exposes a "Manage agents" link that opens an inline editor for saved Agentforce agent profiles. Each profile has:

- **Label** — Display name (e.g., "Sales Demo Agent")
- **Agent ID** — Salesforce Agent record ID (starts with `0Xx`)
- **Description** — Optional notes about what the agent is for

The first profile seeds automatically from the `SF_AGENT_ID` env var when you start the app. After that, profiles live in browser localStorage.

To switch between agents during demos, use the picker in the **AI Assistant panel** (not Settings). The Settings page is for setup; the AI panel is for in-the-moment switching.

### Default provider

A dropdown below the provider status panel that selects which provider is active by default when the AI Assistant panel first opens. The user can still switch providers via the panel's toggle — this is just the starting state.

Useful when you want a specific demo to open with Agentforce (for example) instead of Local.

## What's NOT in Settings

A few things you might expect to find but won't:

- **Login / sign-out** — Authentication state lives in the sidebar, not Settings
- **API keys** — Provider credentials are configured via env vars, not the UI (intentional, to avoid exposing them in localStorage)
- **Demo data toggles** — Removed in earlier versions. The app reads live Salesforce data from your authenticated org.
- **Notification settings** — Notification polling behavior is not user-configurable; it polls every 30 seconds when alerts exist
- **Per-user roles or permissions** — The app respects Salesforce RBAC; there's nothing to configure on the dashboard side

## Recommended demo workflow

For SE colleagues using this app for customer demos:

1. **Per customer** — Use Section 02 (Brand from website) to extract the customer's brand identity automatically. Or set palette/typography/logo manually.
2. **Save as a preset** — Section 01 (Presets) → "+ New preset" so you can switch back to this customer brand later with one click.
3. **Tune the prompts library** — Section 07 to set up questions relevant to that customer's industry or use case.
4. **Set default provider** — Section 08 to pre-select which AI mode the demo opens with (Local for flexibility, Hosted for the Salesforce-native story, Agentforce for the Trust Layer story).
5. **Switch agents on the fly during the demo** — Use the picker in the AI Assistant panel, not Settings.

This workflow turns the same codebase into a customer-specific demo in under 2 minutes per customer.