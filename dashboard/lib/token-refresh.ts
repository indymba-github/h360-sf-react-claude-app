// Shared Salesforce token refresh logic.
// Called from middleware (Edge Runtime), route handlers, and the chat agentic loop.
// Do NOT import next/headers here — this file must stay Edge-compatible.
import type { IronSession } from "iron-session";
import type { SessionData } from "./session-config";

interface SFTokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchange the session's refresh_token for a new access_token, update the
 * session in place, and save it.  Returns the new access token.
 *
 * Throws if no refresh token is available or if Salesforce rejects the request.
 */
export async function refreshSession(session: IronSession<SessionData>): Promise<string> {
  if (!session.refreshToken) {
    throw new Error("no_refresh_token");
  }

  const tokenRes = await fetch(
    `${process.env.SF_LOGIN_URL}/services/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
        client_id: process.env.SF_CLIENT_ID!,
        client_secret: process.env.SF_CLIENT_SECRET!,
      }),
    }
  );

  const tokens = (await tokenRes.json()) as SFTokenResponse;

  if (!tokenRes.ok || tokens.error) {
    throw new Error(tokens.error_description ?? tokens.error ?? "Refresh failed");
  }

  session.accessToken = tokens.access_token;
  if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
  session.tokenIssuedAt = Date.now();
  await session.save();

  return tokens.access_token;
}

/**
 * Exchange the session's mcpRefreshToken for a new mcpAccessToken, update the
 * session in place, and save it.  Returns the new access token.
 *
 * Uses SF_MCP_CLIENT_ID with no client_secret (PKCE / public client app).
 * Throws if no MCP refresh token is available or if Salesforce rejects the grant.
 */
export async function refreshMcpSession(session: IronSession<SessionData>): Promise<string> {
  if (!session.mcpRefreshToken) {
    throw new Error("no_mcp_refresh_token");
  }

  const tokenRes = await fetch(
    `${process.env.SF_LOGIN_URL}/services/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.mcpRefreshToken,
        client_id: process.env.SF_MCP_CLIENT_ID!,
        // No client_secret — the MCP External Client App is a public/PKCE client
      }),
    }
  );

  const tokens = (await tokenRes.json()) as SFTokenResponse;

  if (!tokenRes.ok || tokens.error) {
    throw new Error(tokens.error_description ?? tokens.error ?? "MCP token refresh failed");
  }

  session.mcpAccessToken = tokens.access_token;
  if (tokens.refresh_token) session.mcpRefreshToken = tokens.refresh_token;
  await session.save();

  return tokens.access_token;
}

/**
 * Age threshold (ms) after which a proactive refresh is attempted.
 * Salesforce's default session timeout is 2 hours; we refresh at 90 min.
 */
export const PROACTIVE_REFRESH_THRESHOLD_MS = 90 * 60 * 1000;
