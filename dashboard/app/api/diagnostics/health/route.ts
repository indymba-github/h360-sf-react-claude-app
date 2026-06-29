import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { buildConnectionHealth, getCredentialSourceLabel } from "@/lib/connection-health";
import { getSession } from "@/lib/session";
import { localMcpServerPath } from "@/lib/mcp-config";

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export async function GET() {
  const session = await getSession();
  const serverCredentialsConfigured = Boolean(
    hasValue(process.env.SF_SERVER_CLIENT_ID) &&
    hasValue(process.env.SF_SERVER_CLIENT_SECRET)
  );
  const agentforceLegacyCredentialsConfigured = Boolean(
    hasValue(process.env.SF_AGENT_CLIENT_ID) &&
    hasValue(process.env.SF_AGENT_CLIENT_SECRET)
  );
  const modelsLegacyCredentialsConfigured = Boolean(
    hasValue(process.env.SF_MODELS_CLIENT_ID) &&
    hasValue(process.env.SF_MODELS_CLIENT_SECRET)
  );
  const agentforceCredentialSource = getCredentialSourceLabel({
    serverCredentialsConfigured,
    legacyCredentialsConfigured: agentforceLegacyCredentialsConfigured,
    legacyEnvLabel: "SF_AGENT_*",
  });
  const trustLayerCredentialSource = getCredentialSourceLabel({
    serverCredentialsConfigured,
    legacyCredentialsConfigured: modelsLegacyCredentialsConfigured,
    legacyEnvLabel: "SF_MODELS_*",
  });

  return NextResponse.json(buildConnectionHealth({
    salesforceAuthenticated: Boolean(session.accessToken && session.instanceUrl),
    localMcpEnabled: process.env.LOCAL_MCP_ENABLED !== "false",
    localMcpServerFound: existsSync(localMcpServerPath),
    hostedMcpUrlConfigured: hasValue(process.env.SF_MCP_SERVER_URL),
    hostedMcpAuthenticated: Boolean(session.mcpAccessToken),
    agentforceCredentialsConfigured: Boolean(agentforceCredentialSource),
    agentforceCredentialSource,
    trustLayerCredentialsConfigured: Boolean(trustLayerCredentialSource),
    trustLayerCredentialSource,
    anthropicConfigured: hasValue(process.env.ANTHROPIC_API_KEY),
  }));
}
