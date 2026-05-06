import { readFileSync, writeFileSync } from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), ".settings.json");

export interface AppSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  appName: string;
  logoBase64: string | null;
  headingFont: string;
  bodyFont: string;
  headingFontUrl: string | null;
  bodyFontUrl: string | null;
  borderRadius: number;   // px, 0–16
  sidebarStyle: "dark" | "light";
}

export const SETTINGS_DEFAULTS: AppSettings = {
  primaryColor: "#2D5BFF",
  secondaryColor: "#0D9488",
  accentColor: "#F59E0B",
  appName: "SF Dashboard",
  logoBase64: null,
  headingFont: "Inter",
  bodyFont: "Inter",
  headingFontUrl: null,
  bodyFontUrl: null,
  borderRadius: 8,
  sidebarStyle: "dark",
};

export function getSettings(): AppSettings {
  try {
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...SETTINGS_DEFAULTS, ...parsed };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
