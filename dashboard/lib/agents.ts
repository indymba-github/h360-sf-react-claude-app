export interface AgentProfile {
  id: string;
  label: string;
  agentId: string;
  description?: string;
  isDefault: boolean;
}

const STORAGE_KEY = "agentforce.profiles";
const ACTIVE_KEY  = "agentforce.activeProfileId";
const VERSION_KEY = "agentforce.version";
const CURRENT_VERSION = "v1";

export async function getAgentProfiles(): Promise<AgentProfile[]> {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(STORAGE_KEY);

  // Always fetch the current env default so we can detect drift.
  const envAgentId = await fetchEnvDefault();

  // Data exists — parse it and check for env drift on the default profile.
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as AgentProfile[];
      // If the env value changed, update the stored default profile to match.
      // User-added profiles (isDefault: false) are never touched.
      if (envAgentId) {
        const defaultIdx = parsed.findIndex((p) => p.id === "default");
        if (defaultIdx !== -1 && parsed[defaultIdx].agentId !== envAgentId) {
          parsed[defaultIdx] = { ...parsed[defaultIdx], agentId: envAgentId };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      }
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      return parsed;
    } catch {}
  }

  // No stored data at all — seed from env.
  const initial: AgentProfile[] = envAgentId
    ? [{ id: "default", label: "Default", agentId: envAgentId, description: "Loaded from SF_AGENT_ID", isDefault: true }]
    : [];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  return initial;
}

async function fetchEnvDefault(): Promise<string | null> {
  try {
    const res = await fetch("/api/config/agentforce-default");
    if (!res.ok) return null;
    const { agentId } = await res.json() as { agentId: string | null };
    return agentId || null;
  } catch {
    return null;
  }
}

export function saveAgentProfiles(profiles: AgentProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  window.dispatchEvent(new CustomEvent("agentforce-profiles-changed"));
}

export function getActiveAgentProfile(profiles: AgentProfile[]): AgentProfile | null {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId) {
    const found = profiles.find((p) => p.id === activeId);
    if (found) return found;
  }
  return profiles[0] ?? null;
}

export function setActiveAgentProfile(profileId: string): void {
  localStorage.setItem(ACTIVE_KEY, profileId);
  window.dispatchEvent(new CustomEvent("agentforce-active-changed"));
}

export function isValidAgentId(id: string): boolean {
  return /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(id.trim());
}
