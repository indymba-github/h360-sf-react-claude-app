import assert from "node:assert/strict";
import test from "node:test";

import { getModelsCredentialLogMessage } from "./salesforce";

test("getModelsCredentialLogMessage labels consolidated credentials", () => {
  assert.equal(
    getModelsCredentialLogMessage(true),
    "[salesforce-llm] Models API credential source: SF_SERVER_*",
  );
});

test("getModelsCredentialLogMessage labels legacy Models credentials without fallback wording", () => {
  const message = getModelsCredentialLogMessage(false);

  assert.equal(
    message,
    "[salesforce-llm] Models API credential source: SF_MODELS_* (legacy env names)",
  );
  assert.equal(message.toLowerCase().includes("falling back"), false);
  assert.equal(message.toLowerCase().includes("fallback"), false);
});
