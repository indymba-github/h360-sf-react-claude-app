import assert from "node:assert/strict";
import test from "node:test";
import { buildBlankPreset, duplicatePreset } from "./preset-library";
import type { DemoPack } from "./demoPacks";

const basePreset: DemoPack = {
  id: "seed-1",
  label: "Acme Bank",
  appName: "Acme",
  logoDataUrl: "/demo-packs/acme.svg",
  palette: {
    accent: "#111111",
    paper: "#ffffff",
    text: "#222222",
    headerBg: "#333333",
    headerFg: "#eeeeee",
  },
  typography: {
    display: "Fraunces",
    body: "Inter",
  },
  description: "Original preset",
  isCustom: false,
};

test("buildBlankPreset creates an editable starting preset", () => {
  assert.deepEqual(buildBlankPreset("custom-1"), {
    id: "custom-1",
    label: "New Preset",
    appName: "My Company",
    logoDataUrl: null,
    palette: {
      accent: "#946F1F",
      paper: "#F4F1EA",
      text: "#1B1F2A",
      headerBg: "#1B1F2A",
      headerFg: "#F4F1EA",
    },
    typography: {
      display: "Source Serif 4",
      body: "Inter",
    },
    description: "",
    isCustom: true,
  });
});

test("duplicatePreset copies branding and marks the copy editable", () => {
  assert.deepEqual(duplicatePreset(basePreset, "custom-copy"), {
    ...basePreset,
    id: "custom-copy",
    label: "Acme Bank (copy)",
    isCustom: true,
  });
});
