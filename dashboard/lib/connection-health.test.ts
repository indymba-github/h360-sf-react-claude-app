import assert from "node:assert/strict";
import test from "node:test";
import { buildConnectionHealth, getCredentialSourceLabel } from "./connection-health";

test("buildConnectionHealth reports ready core connections", () => {
  const health = buildConnectionHealth({
    salesforceAuthenticated: true,
    localMcpEnabled: true,
    localMcpServerFound: true,
    hostedMcpUrlConfigured: true,
    hostedMcpAuthenticated: true,
    agentforceCredentialsConfigured: true,
    trustLayerCredentialsConfigured: true,
    anthropicConfigured: true,
  });

  assert.equal(health.overallStatus, "ready");
  assert.equal(health.checks.find((c) => c.id === "salesforce")?.status, "ready");
  assert.equal(health.checks.find((c) => c.id === "hosted-mcp")?.status, "ready");
});

test("buildConnectionHealth identifies setup gaps", () => {
  const health = buildConnectionHealth({
    salesforceAuthenticated: false,
    localMcpEnabled: true,
    localMcpServerFound: false,
    hostedMcpUrlConfigured: true,
    hostedMcpAuthenticated: false,
    agentforceCredentialsConfigured: false,
    trustLayerCredentialsConfigured: false,
    anthropicConfigured: false,
  });

  assert.equal(health.overallStatus, "needs_setup");
  assert.deepEqual(
    health.checks.filter((c) => c.status === "needs_setup").map((c) => c.id),
    ["salesforce", "local-mcp", "hosted-mcp", "agentforce", "trust-layer", "brand-extraction"],
  );
});

test("buildConnectionHealth treats disabled local MCP as inactive", () => {
  const health = buildConnectionHealth({
    salesforceAuthenticated: true,
    localMcpEnabled: false,
    localMcpServerFound: false,
    hostedMcpUrlConfigured: false,
    hostedMcpAuthenticated: false,
    agentforceCredentialsConfigured: true,
    trustLayerCredentialsConfigured: true,
    anthropicConfigured: true,
  });

  assert.equal(health.checks.find((c) => c.id === "local-mcp")?.status, "inactive");
  assert.equal(health.checks.find((c) => c.id === "hosted-mcp")?.status, "inactive");
}
);


test("getCredentialSourceLabel prefers consolidated credentials over legacy labels", () => {
  assert.equal(
    getCredentialSourceLabel({
      serverCredentialsConfigured: true,
      legacyCredentialsConfigured: true,
      legacyEnvLabel: "SF_AGENT_*",
    }),
    "SF_SERVER_*",
  );

  assert.equal(
    getCredentialSourceLabel({
      serverCredentialsConfigured: false,
      legacyCredentialsConfigured: true,
      legacyEnvLabel: "SF_MODELS_*",
    }),
    "SF_MODELS_* (legacy env names)",
  );

  assert.equal(
    getCredentialSourceLabel({
      serverCredentialsConfigured: false,
      legacyCredentialsConfigured: false,
      legacyEnvLabel: "SF_AGENT_*",
    }),
    null,
  );
});

test("buildConnectionHealth surfaces credential source details", () => {
  const health = buildConnectionHealth({
    salesforceAuthenticated: true,
    localMcpEnabled: true,
    localMcpServerFound: true,
    hostedMcpUrlConfigured: true,
    hostedMcpAuthenticated: true,
    agentforceCredentialsConfigured: true,
    agentforceCredentialSource: "SF_SERVER_*",
    trustLayerCredentialsConfigured: true,
    trustLayerCredentialSource: "SF_MODELS_* (legacy env names)",
    anthropicConfigured: true,
  });

  assert.equal(health.checks.find((c) => c.id === "agentforce")?.credentialSource, "SF_SERVER_*");
  assert.equal(health.checks.find((c) => c.id === "trust-layer")?.credentialSource, "SF_MODELS_* (legacy env names)");
});
