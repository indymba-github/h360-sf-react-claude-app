import type { McpMode } from "./mcp-config";

export function isMcpAuthFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid_token") ||
    normalized.includes("invalid token") ||
    normalized.includes("token expired") ||
    normalized.includes("access_denied")
  );
}

export function shouldRefreshHostedMcpContext({
  effectiveMode,
  hasMcpRefreshToken,
  errorMessage,
}: {
  effectiveMode: McpMode;
  hasMcpRefreshToken: boolean;
  errorMessage: string;
}): boolean {
  return effectiveMode === "hosted" && hasMcpRefreshToken && isMcpAuthFailureMessage(errorMessage);
}
