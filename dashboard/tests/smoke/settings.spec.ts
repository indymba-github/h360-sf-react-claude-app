import { expect, test } from "@playwright/test";
import { addAuthenticatedSession } from "./auth";

const providers = {
  local: {
    configured: true,
    description: "Custom MCP server running on stdio",
    hint: "",
  },
  hosted: {
    configured: true,
    description: "Salesforce-hosted MCP server",
    hint: "",
  },
  agentforce: {
    configured: true,
    description: "Salesforce Agentforce endpoint",
    hint: "",
  },
};

test.beforeEach(async ({ context, page, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");

  await addAuthenticatedSession(context, baseURL);

  await page.route("**/api/config/providers", async (route) => {
    await route.fulfill({ json: providers });
  });

  await page.route("**/api/diagnostics/health", async (route) => {
    await route.fulfill({
      json: {
        summary: { ready: true, warnings: 0, errors: 0 },
        checks: [
          {
            id: "salesforce",
            label: "Salesforce session",
            status: "ready",
            detail: "Authenticated",
          },
        ],
      },
    });
  });

  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({ json: { alerts: [], count: 0 } });
  });

  await page.route("**/api/settings", async (route) => {
    await route.fulfill({ json: {} });
  });
});

test("settings page exposes hosted response path choices", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings." })).toBeVisible();
  await expect(page.getByText("Response path")).toBeVisible();

  const responsePath = page.getByRole("group", { name: "Response path" });
  await expect(responsePath.getByRole("button", { name: "MCP answer" })).toHaveAttribute("aria-pressed", "true");
  await expect(responsePath.getByRole("button", { name: "Agentforce direct" })).toBeVisible();
  await expect(responsePath.getByRole("button", { name: "Trust Layer" })).toBeVisible();
  await expect(page.getByText("Next response: Hosted MCP -> Claude")).toBeVisible();

  await responsePath.getByRole("button", { name: "Trust Layer" }).click();
  await expect(responsePath.getByRole("button", { name: "Trust Layer" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Next response: Hosted MCP context -> Salesforce Models API / Trust Layer")).toBeVisible();
});

test("Trust Layer chat responses show route source diagnostics", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      json: {
        text: "Trust Layer smoke response.",
        toolCalls: [],
        consultedAgentforce: false,
        trustLayerMode: true,
        modelUsed: "sfdc_ai__DefaultGPT4Omni",
        contextPrefetched: true,
        contextSource: "mcp",
        durationMs: 420,
      },
    });
  });

  await page.goto("/settings");

  const responsePath = page.getByRole("group", { name: "Response path" });
  await responsePath.getByRole("button", { name: "Trust Layer" }).click();

  await page.getByPlaceholder(/Ask about your CRM data/).fill("Summarize this account");
  await page.locator("form").getByRole("button").last().click();

  await expect(page.getByText("Trust Layer smoke response.")).toBeVisible();
  await expect(page.getByText("Hosted MCP gathered context ->")).toBeVisible();
  await expect(page.getByText("Source:")).toBeVisible();
  await expect(page.getByText("MCP", { exact: true })).toBeVisible();
});

test("brand extraction preview can apply settings and save a preset", async ({ page }) => {
  await page.route("**/api/settings/extract-brand", async (route) => {
    await route.fulfill({
      json: {
        companyName: "Acme Credit Union",
        logo: null,
        logoUrl: null,
        colors: {
          primary: "#0B4F6C",
          secondary: "#01BAEF",
          accent: "#F9C80E",
          all: ["#0B4F6C", "#01BAEF", "#F9C80E"],
        },
        fonts: {
          heading: "Source Serif 4",
          body: "Inter",
        },
      },
    });
  });

  await page.goto("/settings");

  await page.getByPlaceholder("https://acme.com").fill("https://acme.example");
  await page.getByRole("button", { name: "Extract" }).click();

  await expect(page.getByText("Acme Credit Union").first()).toBeVisible();
  await expect(page.getByTitle("#0B4F6C")).toBeVisible();
  await expect(page.getByText("Source Serif 4 / Inter")).toBeVisible();

  await page.getByRole("button", { name: "Apply to settings" }).click();
  await expect(page.locator("input").filter({ hasText: "" }).nth(0)).toBeVisible();
  await expect(page.locator('input[value="Acme Credit Union"]')).toBeVisible();

  await page.getByRole("button", { name: "Save as preset" }).click();
  await expect(page.getByText('Saved "Acme Credit Union" to presets.')).toBeVisible();
});
