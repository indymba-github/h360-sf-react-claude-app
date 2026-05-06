import path from "node:path";

export type McpMode = "local" | "hosted" | "agentforce";

/** Default MCP mode from the environment — used when no session override is set. */
export const defaultMcpMode = (process.env.MCP_MODE ?? "local") as McpMode;

/** @deprecated use defaultMcpMode — kept for back-compat with existing imports */
export const mcpMode = defaultMcpMode;

export const localMcpServerPath =
  process.env.MCP_SERVER_PATH ??
  path.join(process.cwd(), "..", "salesforce-mcp-server", "dist", "index.js");

export const hostedMcpServerUrl = process.env.SF_MCP_SERVER_URL ?? "";

/** Returns the effective MCP mode: session override wins, env default is the fallback. */
export function getEffectiveMcpMode(sessionMode?: string): McpMode {
  if (sessionMode === "local" || sessionMode === "hosted" || sessionMode === "agentforce") return sessionMode;
  return defaultMcpMode;
}
