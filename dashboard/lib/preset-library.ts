import type { DemoPack } from "./demoPacks";

export function buildBlankPreset(id: string): DemoPack {
  return {
    id,
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
  };
}

export function duplicatePreset(preset: DemoPack, id: string): DemoPack {
  return {
    ...preset,
    id,
    label: `${preset.label} (copy)`,
    isCustom: true,
  };
}
