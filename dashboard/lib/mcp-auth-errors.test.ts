import assert from "node:assert/strict";
import test from "node:test";
import { isMcpAuthFailureMessage, shouldRefreshHostedMcpContext } from "./mcp-auth-errors";

test("isMcpAuthFailureMessage recognizes Hosted MCP invalid token errors", () => {
  assert.equal(
    isMcpAuthFailureMessage('Streamable HTTP error: Error POSTing to endpoint: {"errors":[{"message":"Invalid token"}]}'),
    true,
  );
});

test("shouldRefreshHostedMcpContext only refreshes hosted mode with a refresh token", () => {
  assert.equal(shouldRefreshHostedMcpContext({
    effectiveMode: "hosted",
    hasMcpRefreshToken: true,
    errorMessage: "Invalid token",
  }), true);

  assert.equal(shouldRefreshHostedMcpContext({
    effectiveMode: "hosted",
    hasMcpRefreshToken: false,
    errorMessage: "Invalid token",
  }), false);

  assert.equal(shouldRefreshHostedMcpContext({
    effectiveMode: "local",
    hasMcpRefreshToken: true,
    errorMessage: "Invalid token",
  }), false);
});
