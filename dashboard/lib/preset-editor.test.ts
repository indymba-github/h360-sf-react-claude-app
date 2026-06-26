import assert from "node:assert/strict";
import test from "node:test";

import { getPresetLogoCaption } from "./preset-editor";

test("getPresetLogoCaption is empty without a logo", () => {
  assert.equal(getPresetLogoCaption(null), "");
});

test("getPresetLogoCaption identifies uploaded data logos", () => {
  const logo = `data:image/svg+xml;base64,${"a".repeat(1368)}`;

  assert.equal(getPresetLogoCaption(logo), "Custom upload, 1 KB");
});

test("getPresetLogoCaption shows the filename for bundled logos", () => {
  assert.equal(getPresetLogoCaption("/demo-packs/cumulus.svg"), "cumulus.svg");
});

test("getPresetLogoCaption labels remote URL logos", () => {
  assert.equal(getPresetLogoCaption("https://example.com/logo.svg"), "Loaded from URL");
});
