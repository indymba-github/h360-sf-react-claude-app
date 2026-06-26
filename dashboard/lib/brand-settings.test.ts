import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrandSettingsPatch,
  buildPresetFromBrandResult,
  buildPresetSettingsPatch,
  buildServerSettingsPayload,
  deriveBrandLabel,
  findMatchingBrandPreset,
  getDisplayBrandColors,
  summarizeBrandExtraction,
  upsertBrandPreset,
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
    headerFgColor: "#F4F1EA",
    displayFont: "Fraunces",
    bodyFont: "Inter",
  });

  assert.equal(payload.appName, "Acme Financial");
  assert.equal(payload.logoBase64, "data:image/svg+xml;base64,abc123");
  assert.equal(payload.accentColor, "#00a3e0");
  assert.equal(payload.headerBgColor, "#0057b8");
  assert.equal(payload.displayFont, "Fraunces");
});

test("findMatchingBrandPreset matches existing custom presets by label", () => {
  const presets = [
    buildPresetFromBrandResult(extracted, "custom-123", "https://acme.example"),
  ];

  const match = findMatchingBrandPreset(presets, { ...extracted, companyName: " acme financial " });

  assert.equal(match?.id, "custom-123");
});

test("upsertBrandPreset updates a matching custom preset instead of adding a duplicate", () => {
  const existing = buildPresetFromBrandResult(extracted, "custom-123", "https://old.example");
  const changed = {
    ...extracted,
    logo: "data:image/svg+xml;base64,new-logo",
    colors: {
      ...extracted.colors,
      primary: "#112233",
      accent: "#445566",
    },
  };

  const result = upsertBrandPreset([existing], changed, "custom-999", "https://new.example");

  assert.equal(result.action, "updated");
  assert.equal(result.preset.id, "custom-123");
  assert.equal(result.presets.length, 1);
  assert.equal(result.presets[0].logoDataUrl, "data:image/svg+xml;base64,new-logo");
  assert.equal(result.presets[0].palette.accent, "#445566");
  assert.match(result.presets[0].description, /new\.example/);
});

test("upsertBrandPreset creates a preset when no custom match exists", () => {
  const result = upsertBrandPreset([], extracted, "custom-999", "https://acme.example");

  assert.equal(result.action, "created");
  assert.equal(result.preset.id, "custom-999");
  assert.equal(result.presets.length, 1);
  assert.equal(result.presets[0].label, "Acme Financial");
});

test("getDisplayBrandColors falls back to selected colors when all is empty", () => {
  const partial = {
    ...extracted,
    colors: { primary: "#123456", secondary: "#abcdef", accent: "#fedcba", all: [] },
  };

  assert.deepEqual(getDisplayBrandColors(partial), ["#123456", "#abcdef", "#fedcba"]);
});

test("deriveBrandLabel falls back to a readable name from source URL", () => {
  const partial = { ...extracted, companyName: null };

  assert.equal(deriveBrandLabel(partial, "https://www.regions.com/"), "Regions");
});

test("buildBrandSettingsPatch uses source URL fallback for missing company name", () => {
  const patch = buildBrandSettingsPatch({ ...extracted, companyName: null }, "https://www.regions.com/");

  assert.equal(patch.appName, "Regions");
});

test("getDisplayBrandColors is empty when no usable colors were extracted", () => {
  const partial = {
    ...extracted,
    colors: { primary: null, secondary: null, accent: null, all: [] },
  };

  assert.deepEqual(getDisplayBrandColors(partial), []);
});

test("buildBrandSettingsPatch leaves colors untouched when extraction has no colors", () => {
  const partial = {
    ...extracted,
    companyName: null,
    logo: null,
    colors: { primary: null, secondary: null, accent: null, all: [] },
    fonts: { heading: null, body: null },
  };

  const patch = buildBrandSettingsPatch(partial, "https://www.regions.com/personal-banking");

  assert.deepEqual(patch, { appName: "Regions" });
});

test("summarizeBrandExtraction exposes saveable preview details", () => {
  const summary = summarizeBrandExtraction(extracted, "https://acme.example");

  assert.equal(summary.displayName, "Acme Financial");
  assert.deepEqual(summary.colors.slice(0, 3), ["#0057b8", "#f2a900", "#00a3e0"]);
  assert.deepEqual(summary.fonts, ["Fraunces", "Inter"]);
  assert.equal(summary.hasSaveableLogo, true);
  assert.equal(summary.hasLogoUrlOnly, false);
  assert.equal(summary.hasThemeDetails, true);
});

test("summarizeBrandExtraction treats url-only logos as not saveable theme details", () => {
  const partial = {
    ...extracted,
    companyName: null,
    logo: null,
    logoUrl: "https://www.regions.com/logo.svg",
    colors: { primary: null, secondary: null, accent: null, all: [] },
    fonts: { heading: null, body: null },
  };

  const summary = summarizeBrandExtraction(partial, "https://www.regions.com/personal-banking");

  assert.equal(summary.displayName, "Regions");
  assert.deepEqual(summary.colors, []);
  assert.deepEqual(summary.fonts, []);
  assert.equal(summary.hasSaveableLogo, false);
  assert.equal(summary.hasLogoUrlOnly, true);
  assert.equal(summary.hasThemeDetails, false);
});

test("buildPresetSettingsPatch maps an activated preset into persisted settings", () => {
  const preset = buildPresetFromBrandResult(extracted, "custom-123", "https://acme.example");
  const patch = buildPresetSettingsPatch(preset);

  assert.deepEqual(patch, {
    accentColor: "#00a3e0",
    paperColor: "#F4F1EA",
    textColor: "#1B1F2A",
    headerBgColor: "#0057b8",
    headerFgColor: "#F4F1EA",
    inkColor: "#0057b8",
    displayFont: "Fraunces",
    bodyFont: "Inter",
    appName: "Acme Financial",
    logoBase64: "data:image/svg+xml;base64,abc123",
  });
});
