import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { type SessionData, sessionOptions } from "@/lib/session-config";
import { PROACTIVE_REFRESH_THRESHOLD_MS } from "@/lib/token-refresh";

const PROTECTED_PREFIXES = ["/dashboard", "/accounts"];

interface SFTokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cheap presence check before decrypting
  if (!request.cookies.get(sessionOptions.cookieName)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Decrypt session to check token age (only for GET — page navigations)
  // POST requests (API calls) handle refresh reactively inside the route handler
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  try {
    // iron-session supports NextRequest/NextResponse (uses Web Crypto via iron-webcrypto)
    const tmpResponse = NextResponse.next();
    const session = await getIronSession<SessionData>(request, tmpResponse, sessionOptions);

    if (!session.accessToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const ageMs = session.tokenIssuedAt ? Date.now() - session.tokenIssuedAt : Infinity;

    if (ageMs > PROACTIVE_REFRESH_THRESHOLD_MS && session.refreshToken) {
      // Attempt proactive refresh
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

      if (tokenRes.ok) {
        const tokens = (await tokenRes.json()) as SFTokenResponse;
        if (tokens.access_token && !tokens.error) {
          session.accessToken = tokens.access_token;
          if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
          session.tokenIssuedAt = Date.now();
          // Save writes the new cookie onto tmpResponse
          await session.save();

          // Redirect to the same URL so the browser sends the new cookie with
          // the actual page request — transparent to the user.
          const redirectResponse = NextResponse.redirect(request.url);
          // Transfer the Set-Cookie header from tmpResponse to the redirect
          const setCookie = tmpResponse.headers.get("set-cookie");
          if (setCookie) redirectResponse.headers.set("set-cookie", setCookie);
          return redirectResponse;
        }
      }
      // If refresh failed, let the request through — page error boundary handles it
    }

    return tmpResponse;
  } catch {
    // Decryption or network failure — let the request through
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/accounts/:path*"],
};
