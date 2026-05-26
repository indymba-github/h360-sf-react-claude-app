import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

interface SFTokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface SFUserInfo {
  user_id: string;
  organization_id: string;
  display_name?: string;
  email?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  if (error) {
    console.error("OAuth error from Salesforce:", error, searchParams.get("error_description"));
    return redirect(`/?error=${encodeURIComponent(error)}`);
  }

  // CSRF: verify state matches what we set in /api/auth/login
  const storedState = request.cookies.get("sf-oauth-state")?.value;
  if (!state || !storedState || state !== storedState) {
    console.error("OAuth state mismatch");
    return redirect("/?error=state_mismatch");
  }

  if (!code) {
    return redirect("/?error=missing_code");
  }

  // PKCE: retrieve the verifier stored during /api/auth/login
  const codeVerifier = request.cookies.get("sf-pkce-verifier")?.value;
  if (!codeVerifier) {
    console.error("Missing PKCE code_verifier cookie");
    return redirect("/?error=missing_verifier");
  }

  // Exchange authorization code for tokens
  let tokens: SFTokenResponse;
  try {
    const tokenRes = await fetch(
      `${process.env.SF_LOGIN_URL}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.SF_CLIENT_ID!,
          client_secret: process.env.SF_CLIENT_SECRET!,
          redirect_uri: process.env.SF_CALLBACK_URL!,
          code_verifier: codeVerifier,
        }),
      }
    );

    tokens = (await tokenRes.json()) as SFTokenResponse;

    if (!tokenRes.ok || tokens.error) {
      throw new Error(tokens.error_description ?? tokens.error ?? "Token exchange failed");
    }
  } catch (err) {
    console.error("Token exchange error:", err);
    return redirect("/?error=token_exchange");
  }

  // Fetch user identity from the token's `id` URL
  let userInfo: SFUserInfo;
  try {
    const userRes = await fetch(tokens.id, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    userInfo = (await userRes.json()) as SFUserInfo;
  } catch (err) {
    console.error("User info fetch error:", err);
    return redirect("/?error=user_info");
  }

  // Persist session
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.accessToken = tokens.access_token;
  session.refreshToken = tokens.refresh_token;
  session.instanceUrl = tokens.instance_url;
  session.userId = userInfo.user_id;
  session.orgId = userInfo.organization_id;
  session.displayName = userInfo.display_name ?? userInfo.email ?? "Salesforce User";
  session.email = userInfo.email;
  session.tokenIssuedAt = Date.now();
  await session.save();

  // Clear CSRF + PKCE cookies and send user to the dashboard
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.delete("sf-oauth-state");
  response.cookies.delete("sf-pkce-verifier");
  return response;
}
