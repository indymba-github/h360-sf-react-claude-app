export type Provider = "local" | "hosted" | "agentforce";

export interface ProviderStatus {
  configured: boolean;
  description: string;
  hint: string;
}

export type ProvidersConfig = Record<Provider, ProviderStatus>;

const FALLBACK: ProvidersConfig = {
  local:      { configured: true,  description: "Custom MCP server running on stdio",   hint: "" },
  hosted:     { configured: false, description: "Salesforce-hosted MCP server",          hint: "Set SF_MCP_SERVER_URL in .env.local" },
  agentforce: { configured: false, description: "Salesforce Agentforce endpoint",        hint: "Set SF_AGENT_CLIENT_ID and SF_AGENT_CLIENT_SECRET in .env.local. Configure agents in Settings." },
};

let cachedConfig: ProvidersConfig | null = null;

export async function getProvidersConfig(): Promise<ProvidersConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch("/api/config/providers");
    if (!res.ok) return FALLBACK;
    cachedConfig = await res.json() as ProvidersConfig;
    return cachedConfig;
  } catch {
    return FALLBACK;
  }
}

export async function getConfiguredProviders(): Promise<Provider[]> {
  const config = await getProvidersConfig();
  return (Object.keys(config) as Provider[]).filter((p) => config[p].configured);
}

export function clearProvidersCache(): void {
  cachedConfig = null;
}

export async function getDefaultProvider(): Promise<Provider | null> {
  const available = await getConfiguredProviders();
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("ai-panel.default-provider") as Provider | null;
    if (stored && available.includes(stored)) return stored;
  }
  return available[0] ?? null;
}

export function setDefaultProvider(provider: Provider): void {
  localStorage.setItem("ai-panel.default-provider", provider);
  localStorage.setItem("ai-panel.provider", provider);
  window.dispatchEvent(new CustomEvent("default-provider-changed"));
}

// Label/display helpers — no env var reads needed client-side
export const PROVIDER_LABELS: Record<Provider, string> = {
  local:      "Local",
  hosted:     "Hosted",
  agentforce: "Agentforce",
};
