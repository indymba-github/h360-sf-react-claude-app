import { readFileSync, writeFileSync } from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), ".settings.json");

export interface AppSettings {
  accentColor: string;
  paperColor: string | null;
  textColor: string | null;      // body text color
  headerBgColor: string | null;  // header background
  headerFgColor: string | null;  // header text
  inkColor: string | null;       // legacy — kept for migration
  appName: string;
  logoBase64: string | null;
  trustLayerModel: string | null; // SF Models API name for Trust Layer mode
}

export const SETTINGS_DEFAULTS: AppSettings = {
  accentColor: "#946F1F",
  paperColor: null,
  textColor: null,
  headerBgColor: null,
  headerFgColor: null,
  inkColor: null,
  appName: "Cumulus Bank",
  logoBase64: null,
  trustLayerModel: null,
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
