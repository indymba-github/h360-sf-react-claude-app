import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3107);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const sessionSecret = process.env.SESSION_SECRET ?? "test-session-secret-at-least-32-characters";

process.env.SESSION_SECRET = sessionSecret;

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "test-anthropic-key",
      SESSION_SECRET: sessionSecret,
      SF_CLIENT_ID: process.env.SF_CLIENT_ID ?? "test-client-id",
      SF_CLIENT_SECRET: process.env.SF_CLIENT_SECRET ?? "test-client-secret",
      SF_LOGIN_URL: process.env.SF_LOGIN_URL ?? "https://login.salesforce.com",
      SF_CALLBACK_URL: process.env.SF_CALLBACK_URL ?? `${baseURL}/api/auth/callback`,
      SF_MCP_SERVER_URL: process.env.SF_MCP_SERVER_URL ?? "https://mcp.example.test",
      LOCAL_MCP_ENABLED: process.env.LOCAL_MCP_ENABLED ?? "true",
    },
  },
});
