import assert from "node:assert/strict";
import test from "node:test";

import {
  RESPONSE_PATH_LABELS,
  buildRouteDiagnostics,
  getRouteDiagnosticsRows,
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
    getRouteReceiptText({ baseMode: "hosted", path: "trust-layer", contextSource: "mcp+rest" }),
    "Hosted MCP + Salesforce REST gathered context -> Salesforce Models API answered through the Trust Layer",
  );
  assert.equal(
    getRouteReceiptText({ baseMode: "hosted", path: "agentforce-direct" }),
    "Agentforce answered directly",
  );
});

test("route diagnostics summarize default MCP answers", () => {
  const diagnostics = buildRouteDiagnostics({
    baseMode: "hosted",
    path: "default",
    toolCount: 3,
    durationMs: 1420,
  });

  assert.deepEqual(diagnostics, {
    baseMode: "hosted",
    path: "default",
    dataLayer: "Hosted MCP",
    answerLayer: "Claude",
    trustLayer: false,
    toolCount: 3,
    durationLabel: "1.4s",
  });
});

test("route diagnostics identify Trust Layer answers", () => {
  const diagnostics = buildRouteDiagnostics({
    baseMode: "local",
    path: "trust-layer",
    modelLabel: "GPT-4.1",
    contextSource: "rest",
    durationMs: 840,
  });

  assert.equal(diagnostics.dataLayer, "Salesforce REST");
  assert.equal(diagnostics.answerLayer, "GPT-4.1");
  assert.equal(diagnostics.sourceLabel, "Salesforce REST");
  assert.equal(diagnostics.trustLayer, true);
  assert.equal(diagnostics.durationLabel, "840ms");
});

test("route diagnostics identify Agentforce direct answers", () => {
  const diagnostics = buildRouteDiagnostics({
    baseMode: "hosted",
    path: "agentforce-direct",
  });

  assert.equal(diagnostics.dataLayer, "None");
  assert.equal(diagnostics.answerLayer, "Agentforce");
  assert.equal(diagnostics.trustLayer, true);
});

test("route diagnostics rows are display ready", () => {
  const rows = getRouteDiagnosticsRows(buildRouteDiagnostics({
    baseMode: "hosted",
    path: "trust-layer",
    contextSource: "mcp",
    toolCount: 2,
    durationMs: 2200,
  }));

  assert.deepEqual(rows, [
    { label: "Data", value: "Hosted MCP" },
    { label: "Source", value: "MCP" },
    { label: "Answer", value: "Salesforce Models API" },
    { label: "Trust", value: "Yes" },
    { label: "Tools", value: "2" },
    { label: "Time", value: "2.2s" },
  ]);
});

test("route diagnostics identify hybrid MCP and REST Trust Layer context", () => {
  const rows = getRouteDiagnosticsRows(buildRouteDiagnostics({
    baseMode: "hosted",
    path: "trust-layer",
    contextSource: "mcp+rest",
    durationMs: 3600,
  }));

  assert.deepEqual(rows, [
    { label: "Data", value: "Hosted MCP + Salesforce REST" },
    { label: "Source", value: "MCP + Salesforce REST" },
    { label: "Answer", value: "Salesforce Models API" },
    { label: "Trust", value: "Yes" },
    { label: "Tools", value: "0" },
    { label: "Time", value: "3.6s" },
  ]);
});
