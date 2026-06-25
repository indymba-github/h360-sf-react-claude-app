import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrandSettingsPatch,
  buildPresetFromBrandResult,
  buildServerSettingsPayload,
} from "./brand-settings";

const extracted = {
  companyName: "Acme Financial",
  logo: "data:image/svg+xml;base64,abc123",
  logoUrl: "https://acme.example/logo.svg",
  colors: {
    primary: "#0057b8",
    secondary: "#f2a900",
    accent: "#00a3e0",
    all: ["#0057b8", "#f2a900", "#00a3e0"],
  },
  fonts: {
    heading: "Fraunces",
    body: "Inter",
  },
};

test("buildBrandSettingsPatch turns extracted identity into persisted settings", () => {
  const patch = buildBrandSettingsPatch(extracted);

  assert.equal(patch.appName, "Acme Financial");
  assert.equal(patch.logoBase64, "data:image/svg+xml;base64,abc123");
  assert.equal(patch.accentColor, "#00a3e0");
  assert.equal(patch.headerBgColor, "#0057b8");
  assert.equal(patch.displayFont, "Fraunces");
  assert.equal(patch.bodyFont, "Inter");
});

test("buildPresetFromBrandResult saves extracted branding as a custom preset", () => {
  const preset = buildPresetFromBrandResult(extracted, "custom-123", "https://acme.example");

  assert.equal(preset.id, "custom-123");
  assert.equal(preset.label, "Acme Financial");
  assert.equal(preset.appName, "Acme Financial");
  assert.equal(preset.logoDataUrl, "data:image/svg+xml;base64,abc123");
  assert.equal(preset.palette.accent, "#00a3e0");
  assert.equal(preset.palette.headerBg, "#0057b8");
  assert.equal(preset.isCustom, true);
  assert.match(preset.description, /acme\.example/);
});

test("buildServerSettingsPayload includes app identity from local settings", () => {
  const payload = buildServerSettingsPayload({
    appName: "Acme Financial",
    logoBase64: "data:image/svg+xml;base64,abc123",
    accentColor: "#00a3e0",
    paperColor: "#f4f1ea",
    textColor: "#1b1f2a",
    headerBgColor: "#0057b8",
    headerFgColor: "#ffffff",
    displayFont: "Fraunces",
    bodyFont: "Inter",
  });

  assert.equal(payload.appName, "Acme Financial");
  assert.equal(payload.logoBase64, "data:image/svg+xml;base64,abc123");
  assert.equal(payload.accentColor, "#00a3e0");
  assert.equal(payload.headerBgColor, "#0057b8");
  assert.equal(payload.displayFont, "Fraunces");
});
