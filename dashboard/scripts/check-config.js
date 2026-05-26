#!/usr/bin/env node
// Validates required environment variables before the app starts.
// Runs automatically on `npm run dev` and `npm start` via predev/prestart hooks.
//
// Explicitly loads dashboard/.env.local so the script works correctly
// regardless of the working directory it is invoked from.

const path = require("path");
const fs = require("fs");

// ── Load .env.local ────────────────────────────────────────────────────────
// Script lives at dashboard/scripts/check-config.js
// .env.local lives at dashboard/.env.local — one level up from this file.
const envPath = path.resolve(__dirname, "..", ".env.local");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} else {
  console.warn(`\nℹ️   No .env.local found at ${envPath}`);
  console.warn("   Copy .env.example to .env.local and fill in values.\n");
  // Don't exit here — let the variable checks below produce the specific errors.
}

// ── Validation ─────────────────────────────────────────────────────────────

const required = {
  ANTHROPIC_API_KEY: "Get one at https://console.anthropic.com",
  SESSION_SECRET:    "Generate with: openssl rand -base64 32",
  SF_CLIENT_ID:    "See docs/SALESFORCE_SETUP.md — Consumer Key from your Connected App",
  SF_CLIENT_SECRET:"See docs/SALESFORCE_SETUP.md — Consumer Secret from your Connected App",
  SF_LOGIN_URL:    "Usually https://login.salesforce.com  (use https://test.salesforce.com for sandboxes)",
  SF_CALLBACK_URL: "Usually http://localhost:3000/api/auth/callback",
};

let failed = false;

function check(vars) {
  for (const [key, hint] of Object.entries(vars)) {
    if (!process.env[key]) {
      if (!failed) console.error("\n❌  Missing required environment variables:\n");
      console.error(`  ${key}`);
      console.error(`     ${hint}\n`);
      failed = true;
    }
  }
}

check(required);

if (failed) {
  console.error("Copy .env.example to .env.local and fill in the values above, then try again.\n");
  process.exit(1);
}

// ── Optional provider info ─────────────────────────────────────────────────
// Not errors, but helpful to know what's active.

const localEnabled  = process.env.LOCAL_MCP_ENABLED !== "false";
const hostedEnabled = !!process.env.SF_MCP_SERVER_URL;
const agentEnabled  = !!(process.env.SF_AGENT_CLIENT_ID && process.env.SF_AGENT_CLIENT_SECRET && process.env.SF_AGENT_ID);

if (!localEnabled && !hostedEnabled && !agentEnabled) {
  console.warn("⚠️   No AI providers are configured. At least one of these is needed:");
  console.warn("      Local:      LOCAL_MCP_ENABLED=true (default)");
  console.warn("      Hosted:     SF_MCP_SERVER_URL=<url>");
  console.warn("      Agentforce: SF_AGENT_CLIENT_ID + SF_AGENT_CLIENT_SECRET + SF_AGENT_ID\n");
}
