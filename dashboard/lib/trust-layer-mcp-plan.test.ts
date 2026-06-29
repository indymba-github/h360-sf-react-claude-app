import assert from "node:assert/strict";
import test from "node:test";

import { buildTrustLayerMcpCalls } from "./trust-layer-mcp-plan";

test("buildTrustLayerMcpCalls uses local curated tools when they are available", () => {
  const calls = buildTrustLayerMcpCalls({
    availableToolNames: [
      "sf_get_account",
      "sf_get_opportunities",
      "sf_get_contacts",
      "sf_get_cases",
    ],
    accountId: "001abc",
  });

  assert.deepEqual(calls.map((call) => call.toolName), [
    "sf_get_account",
    "sf_get_opportunities",
    "sf_get_contacts",
    "sf_get_cases",
  ]);
  assert.deepEqual(calls[0].args, { account_id: "001abc" });
});

test("buildTrustLayerMcpCalls uses hosted soqlQuery when local tools are unavailable", () => {
  const calls = buildTrustLayerMcpCalls({
    availableToolNames: ["getUserInfo", "soqlQuery"],
    accountId: "001abc",
  });

  assert.ok(calls.length >= 4);
  assert.equal(calls[0].toolName, "soqlQuery");
  assert.deepEqual(calls[0].args, {
    query: "SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website, BillingCity, BillingState, Type, Owner.Name FROM Account WHERE Id = '001abc' LIMIT 1",
  });
  assert.ok(calls.every((call) => call.toolName === "soqlQuery"));
});

test("buildTrustLayerMcpCalls recognizes hosted scoped soqlQuery tool names", () => {
  const calls = buildTrustLayerMcpCalls({
    availableToolNames: [
      "getRelatedRecordsplatform_sobject_all",
      "listRecentSobjectRecordsplatform_sobject_all",
      "soqlQueryplatform_sobject_all",
      "findplatform_sobject_all",
    ],
    accountId: "001abc",
  });

  assert.ok(calls.length >= 4);
  assert.ok(calls.every((call) => call.toolName === "soqlQueryplatform_sobject_all"));
});

test("buildTrustLayerMcpCalls uses q for hosted SOQL tools that expose q", () => {
  const calls = buildTrustLayerMcpCalls({
    availableTools: [
      {
        name: "soqlQueryplatform_sobject_all",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string" },
          },
        },
      },
    ],
    accountId: "001abc",
  });

  assert.ok(calls.length >= 4);
  assert.equal(calls[0].toolName, "soqlQueryplatform_sobject_all");
  assert.deepEqual(calls[0].args, {
    q: "SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website, BillingCity, BillingState, Type, Owner.Name FROM Account WHERE Id = '001abc' LIMIT 1",
  });
});

test("buildTrustLayerMcpCalls escapes generated SOQL literals", () => {
  const calls = buildTrustLayerMcpCalls({
    availableToolNames: ["soqlQuery"],
    accountId: "001'abc\nbad",
  });

  assert.equal(
    calls[0].args.query,
    "SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, Phone, Website, BillingCity, BillingState, Type, Owner.Name FROM Account WHERE Id = '001\\'abc bad' LIMIT 1",
  );
});
