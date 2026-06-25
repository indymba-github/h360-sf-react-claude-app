import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextResponseDescription,
  getSelectableResponsePaths,
  normalizeResponsePath,
} from "./response-path";

test("Agentforce base mode only allows the default response path", () => {
  assert.deepEqual(getSelectableResponsePaths("agentforce"), ["default"]);
  assert.equal(normalizeResponsePath("agentforce", "trust-layer"), "default");
  assert.equal(normalizeResponsePath("agentforce", "agentforce-direct"), "default");
});

test("Local and Hosted base modes allow all response paths", () => {
  assert.deepEqual(getSelectableResponsePaths("local"), ["default", "agentforce-direct", "trust-layer"]);
  assert.deepEqual(getSelectableResponsePaths("hosted"), ["default", "agentforce-direct", "trust-layer"]);
});

test("next response descriptions distinguish base mode from response path", () => {
  assert.equal(getNextResponseDescription("hosted", "default"), "Next response: Hosted MCP -> Claude");
  assert.equal(getNextResponseDescription("hosted", "agentforce-direct"), "Next response: Agentforce direct");
  assert.equal(
    getNextResponseDescription("local", "trust-layer"),
    "Next response: Local MCP context -> Salesforce Models API / Trust Layer",
  );
});
