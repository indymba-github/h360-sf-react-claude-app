import type { BrowserContext } from "@playwright/test";
import { sealData } from "iron-session";

const SESSION_COOKIE_NAME = "sf-dashboard-session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret-at-least-32-characters";

export async function addAuthenticatedSession(
  context: BrowserContext,
  baseURL: string,
  overrides: Record<string, unknown> = {},
) {
  const value = await sealData({
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    instanceUrl: "https://example.my.salesforce.com",
    displayName: "Smoke Tester",
    email: "smoke@example.test",
    tokenIssuedAt: Date.now(),
    mcpMode: "hosted",
    mcpAccessToken: "test-mcp-access-token",
    ...overrides,
  }, {
    password: SESSION_SECRET,
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
