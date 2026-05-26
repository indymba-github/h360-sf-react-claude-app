import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

interface SFTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  if (error) {
    console.error("MCP OAuth error:", error, searchParams.get("error_description"));
    return redirect(`/dashboard?mcp_error=${encodeURIComponent(error)}`);
  }

  const storedState = request.cookies.get("sf-mcp-oauth-state")?.value;
  if (!state || !storedState || state !== storedState) {
    console.error("MCP OAuth state mismatch");
    return redirect("/dashboard?mcp_error=state_mismatch");
  }

  if (!code) {
    return redirect("/dashboard?mcp_error=missing_code");
  }

  const codeVerifier = request.cookies.get("sf-mcp-pkce-verifier")?.value;
  if (!codeVerifier) {
    console.error("Missing MCP PKCE code_verifier cookie");
    return redirect("/dashboard?mcp_error=missing_verifier");
  }

  let tokens: SFTokenResponse;
  try {
    // No client_secret — the External Client App has "Require Secret for Web Server Flow" unchecked
    const tokenRes = await fetch(
      `${process.env.SF_LOGIN_URL}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.SF_MCP_CLIENT_ID!,
          redirect_uri: process.env.SF_MCP_CALLBACK_URL!,
          code_verifier: codeVerifier,
        }),
      }
    );

    tokens = (await tokenRes.json()) as SFTokenResponse;

    if (!tokenRes.ok || tokens.error) {
      throw new Error(tokens.error_description ?? tokens.error ?? "Token exchange failed");
    }
  } catch (err) {
    console.error("MCP token exchange error:", err);
    return redirect("/dashboard?mcp_error=token_exchange");
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.mcpAccessToken = tokens.access_token;
  if (tokens.refresh_token) session.mcpRefreshToken = tokens.refresh_token;
  session.mcpMode = "hosted"; // completing MCP auth means the user wants hosted mode active
  await session.save();

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.delete("sf-mcp-oauth-state");
  response.cookies.delete("sf-mcp-pkce-verifier");
  return response;
}
