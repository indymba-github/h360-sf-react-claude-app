import assert from "node:assert/strict";
import test from "node:test";
import { formatBrandPresetSaveMessage } from "./brand-extraction";

test("formatBrandPresetSaveMessage describes a newly saved preset", () => {
  assert.equal(formatBrandPresetSaveMessage("Regions", "created"), 'Saved "Regions" to presets.');
});

test("formatBrandPresetSaveMessage describes an updated preset", () => {
  assert.equal(formatBrandPresetSaveMessage("Regions", "updated"), 'Updated "Regions" preset.');
});
