import { NextResponse } from "next/server";
import crypto from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SF_MCP_CLIENT_ID!,
    redirect_uri: process.env.SF_MCP_CALLBACK_URL!,
    scope: "mcp_api refresh_token",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${process.env.SF_LOGIN_URL}/services/oauth2/authorize?${params}`;

  const response = NextResponse.redirect(authUrl);

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set("sf-mcp-oauth-state", state, cookieOpts);
  response.cookies.set("sf-mcp-pkce-verifier", codeVerifier, cookieOpts);

  return response;
}
