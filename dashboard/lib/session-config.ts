// Edge-compatible session config — no next/headers import.
// Imported by middleware (Edge Runtime) and lib/session.ts.
import type { SessionOptions } from "iron-session";

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  instanceUrl?: string;
  userId?: string;
  orgId?: string;
  displayName?: string;
  email?: string;
  /** Unix timestamp (ms) when the access token was issued — used for proactive refresh. */
  tokenIssuedAt?: number;
  /** Separate access token obtained via the MCP-specific External Client App (hosted MCP mode). */
  mcpAccessToken?: string;
  /** Refresh token for the MCP-specific External Client App — used to silently renew mcpAccessToken. */
  mcpRefreshToken?: string;
  /** User-selected MCP mode; overrides MCP_MODE env var when set. */
  mcpMode?: "local" | "hosted" | "agentforce";
  /** Agentforce Agent API session ID — persisted so mid-conversation page navigations reuse the session. */
  agentSessionId?: string;
  /** Incrementing sequence counter for the current Agentforce session. */
  agentSequenceId?: number;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "sf-dashboard-session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};
