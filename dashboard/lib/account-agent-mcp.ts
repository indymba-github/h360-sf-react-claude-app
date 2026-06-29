/**
 * Client for the Account Summary Agent MCP — a Salesforce Hosted MCP server
 * that exposes Agentforce agent capabilities as MCP tools. Uses Client
 * Credentials Flow (not PKCE) since the agent runs under a fixed Run As user.
 *
 * This module mirrors the existing Hosted MCP integration but with its own
 * auth path and server URL. Enabled via SF_MCP_ACCOUNT_AGENT_ENABLED=true.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export function getAccountAgentCredentialLogMessage(usesConsolidatedCredentials: boolean): string {
  return usesConsolidatedCredentials
    ? "[account-agent-mcp] Account Agent MCP credential source: SF_SERVER_*"
    : "[account-agent-mcp] Account Agent MCP credential source: SF_MCP_ACCOUNT_AGENT_* (legacy env names)";
}

async function getAccountAgentToken(): Promise<string> {
  const clientId = process.env.SF_SERVER_CLIENT_ID || process.env.SF_MCP_ACCOUNT_AGENT_CLIENT_ID;
  const clientSecret = process.env.SF_SERVER_CLIENT_SECRET || process.env.SF_MCP_ACCOUNT_AGENT_CLIENT_SECRET;
  const loginUrl = process.env.SF_LOGIN_URL?.replace(/\/$/, "");

  console.log(getAccountAgentCredentialLogMessage(Boolean(process.env.SF_SERVER_CLIENT_ID)));

  if (!clientId || !clientSecret || !loginUrl) {
    throw new Error(
      "Account Summary Agent MCP credentials not configured. " +
      "Set SF_SERVER_CLIENT_ID + SF_SERVER_CLIENT_SECRET (or the legacy " +
      "SF_MCP_ACCOUNT_AGENT_CLIENT_ID + SF_MCP_ACCOUNT_AGENT_CLIENT_SECRET), " +
      "and SF_LOGIN_URL in .env.local."
    );
  }

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Account Agent MCP auth failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

/**
 * Connect to the Account Summary Agent MCP and return the initialized client.
 * Caller is responsible for calling client.close() when done.
 */
export async function connectAccountAgentMcp(): Promise<Client> {
  const accessToken = await getAccountAgentToken();
  const serverUrl = process.env.SF_MCP_ACCOUNT_AGENT_SERVER_URL;

  if (!serverUrl) {
    throw new Error("SF_MCP_ACCOUNT_AGENT_SERVER_URL not configured.");
  }

  console.log("[account-agent-mcp] === CONNECTING ===");
  console.log("[account-agent-mcp] URL:", serverUrl);
  console.log("[account-agent-mcp] Token prefix:", accessToken.substring(0, 30));

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json, text/event-stream",
      },
    },
  });

  const client = new Client(
    { name: "sf-mcp-dashboard-account-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("[account-agent-mcp] === CONNECTED ===");
  return client;
}

/** Returns true when the Account Summary Agent MCP is enabled and fully configured. */
export function isAccountAgentEnabled(): boolean {
  return (
    process.env.SF_MCP_ACCOUNT_AGENT_ENABLED === "true" &&
    !!process.env.SF_MCP_ACCOUNT_AGENT_CLIENT_ID &&
    !!process.env.SF_MCP_ACCOUNT_AGENT_CLIENT_SECRET &&
    !!process.env.SF_MCP_ACCOUNT_AGENT_SERVER_URL
  );
}

/** The prefix applied to agent MCP tool names to avoid collisions with hosted tools. */
export const ACCOUNT_AGENT_PREFIX = "aa__";
