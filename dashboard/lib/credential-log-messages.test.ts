import assert from "node:assert/strict";
import test from "node:test";

import { getAccountAgentCredentialLogMessage } from "./account-agent-mcp";
import { getAgentforceCredentialLogMessage } from "./agentforce-client";

test("Agentforce credential log names the selected source without fallback wording", () => {
  assert.equal(
    getAgentforceCredentialLogMessage(true),
    "[agentforce-client] Agentforce credential source: SF_SERVER_*",
  );

  const message = getAgentforceCredentialLogMessage(false);
  assert.equal(message, "[agentforce-client] Agentforce credential source: SF_AGENT_* (legacy env names)");
  assert.equal(message.toLowerCase().includes("fallback"), false);
});

test("Account Agent MCP credential log names the selected source without fallback wording", () => {
  assert.equal(
    getAccountAgentCredentialLogMessage(true),
    "[account-agent-mcp] Account Agent MCP credential source: SF_SERVER_*",
  );

  const message = getAccountAgentCredentialLogMessage(false);
  assert.equal(
    message,
    "[account-agent-mcp] Account Agent MCP credential source: SF_MCP_ACCOUNT_AGENT_* (legacy env names)",
  );
  assert.equal(message.toLowerCase().includes("fallback"), false);
});
