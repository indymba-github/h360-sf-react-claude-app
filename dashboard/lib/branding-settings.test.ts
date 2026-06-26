import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrandingSettings } from "./branding-settings";

test("resolveBrandingSettings falls back to server branding without local settings", () => {
  const result = resolveBrandingSettings(null, "Server Bank", "/server-logo.svg");

  assert.deepEqual(result, { appName: "Server Bank", logoSrc: "/server-logo.svg" });
});

test("resolveBrandingSettings lets stored preset logo override server logo", () => {
  const result = resolveBrandingSettings(
    JSON.stringify({ appName: "Preset Bank", logoBase64: "data:image/svg+xml;base64,preset" }),
    "Server Bank",
    "/server-logo.svg",
  );

  assert.deepEqual(result, { appName: "Preset Bank", logoSrc: "data:image/svg+xml;base64,preset" });
});

test("resolveBrandingSettings treats explicit null logo as clearing the server logo", () => {
  const result = resolveBrandingSettings(JSON.stringify({ logoBase64: null }), "Server Bank", "/server-logo.svg");

  assert.deepEqual(result, { appName: "Server Bank", logoSrc: null });
});
