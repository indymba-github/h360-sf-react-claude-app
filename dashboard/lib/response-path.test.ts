import assert from "node:assert/strict";
import test from "node:test";

import {
  RESPONSE_PATH_LABELS,
  getNextResponseDescription,
  getRouteReceiptText,
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

test("default response path is labeled as an MCP answer", () => {
  assert.equal(RESPONSE_PATH_LABELS.default, "MCP answer");
});

test("route receipts explain the data and answer path", () => {
  assert.equal(
    getRouteReceiptText({ baseMode: "hosted", path: "default" }),
    "Hosted MCP gathered context -> Claude answered",
  );
  assert.equal(
    getRouteReceiptText({ baseMode: "local", path: "trust-layer", modelLabel: "GPT-4.1", contextSource: "mcp" }),
    "Local MCP gathered context -> GPT-4.1 answered through the Trust Layer",
  );
  assert.equal(
    getRouteReceiptText({ baseMode: "hosted", path: "trust-layer", contextSource: "rest" }),
    "Salesforce REST prefetch gathered context -> Salesforce Models API answered through the Trust Layer",
  );
  assert.equal(
    getRouteReceiptText({ baseMode: "hosted", path: "agentforce-direct" }),
    "Agentforce answered directly",
  );
});
