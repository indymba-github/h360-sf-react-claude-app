export type ConnectionHealthStatus = "ready" | "needs_setup" | "inactive";

export interface ConnectionHealthInput {
  salesforceAuthenticated: boolean;
  localMcpEnabled: boolean;
  localMcpServerFound: boolean;
  hostedMcpUrlConfigured: boolean;
  hostedMcpAuthenticated: boolean;
  agentforceCredentialsConfigured: boolean;
  agentforceCredentialSource?: string | null;
  trustLayerCredentialsConfigured: boolean;
  trustLayerCredentialSource?: string | null;
  anthropicConfigured: boolean;
}

export interface ConnectionHealthCheck {
  id: "salesforce" | "local-mcp" | "hosted-mcp" | "agentforce" | "trust-layer" | "brand-extraction";
  label: string;
  status: ConnectionHealthStatus;
  detail: string;
  credentialSource?: string;
}

export interface ConnectionHealth {
  overallStatus: Exclude<ConnectionHealthStatus, "inactive">;
  checks: ConnectionHealthCheck[];
}


export function getCredentialSourceLabel({
  serverCredentialsConfigured,
  legacyCredentialsConfigured,
  legacyEnvLabel,
}: {
  serverCredentialsConfigured: boolean;
  legacyCredentialsConfigured: boolean;
  legacyEnvLabel: string;
}): string | null {
  if (serverCredentialsConfigured) return "SF_SERVER_*";
  if (legacyCredentialsConfigured) return `${legacyEnvLabel} (legacy env names)`;
  return null;
}

export function buildConnectionHealth(input: ConnectionHealthInput): ConnectionHealth {
  const checks: ConnectionHealthCheck[] = [
    {
      id: "salesforce",
      label: "Salesforce session",
      status: input.salesforceAuthenticated ? "ready" : "needs_setup",
      detail: input.salesforceAuthenticated
        ? "Dashboard OAuth session is active."
        : "Connect to Salesforce before using CRM data.",
    },
    {
      id: "local-mcp",
      label: "Local MCP",
      status: !input.localMcpEnabled ? "inactive" : input.localMcpServerFound ? "ready" : "needs_setup",
      detail: !input.localMcpEnabled
        ? "Local MCP is disabled by configuration."
        : input.localMcpServerFound
        ? "Local MCP server build was found."
        : "Build the local MCP server or set MCP_SERVER_PATH.",
    },
    {
      id: "hosted-mcp",
      label: "Hosted MCP",
      status: !input.hostedMcpUrlConfigured ? "inactive" : input.hostedMcpAuthenticated ? "ready" : "needs_setup",
      detail: !input.hostedMcpUrlConfigured
        ? "No hosted MCP endpoint is configured."
        : input.hostedMcpAuthenticated
        ? "Hosted MCP endpoint and user authorization are present."
        : "Authorize Hosted MCP from the AI panel.",
    },
    {
      id: "agentforce",
      label: "Agentforce",
      status: input.agentforceCredentialsConfigured ? "ready" : "needs_setup",
      detail: input.agentforceCredentialsConfigured
        ? "Agentforce client credentials are configured."
        : "Set SF_SERVER_* or SF_AGENT_* credentials.",
      ...(input.agentforceCredentialSource ? { credentialSource: input.agentforceCredentialSource } : {}),
    },
    {
      id: "trust-layer",
      label: "Trust Layer",
      status: input.trustLayerCredentialsConfigured ? "ready" : "needs_setup",
      detail: input.trustLayerCredentialsConfigured
        ? "Salesforce Models API credentials are configured."
        : "Set SF_SERVER_* or SF_MODELS_* credentials.",
      ...(input.trustLayerCredentialSource ? { credentialSource: input.trustLayerCredentialSource } : {}),
    },
    {
      id: "brand-extraction",
      label: "Brand extraction",
      status: input.anthropicConfigured ? "ready" : "needs_setup",
      detail: input.anthropicConfigured
        ? "Anthropic key is available for website brand extraction."
        : "Set ANTHROPIC_API_KEY to enable brand extraction.",
    },
  ];

  const overallStatus = checks.some((check) => check.status === "needs_setup") ? "needs_setup" : "ready";
  return { overallStatus, checks };
}
