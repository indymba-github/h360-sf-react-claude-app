import { readFileSync, writeFileSync } from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), ".settings.json");

export interface AppSettings {
  /** Swappable per-customer accent — maps to --color-accent */
  accentColor: string;
  /** Optional override for --color-ink (for very dark brand colors) */
  inkColor: string | null;
  appName: string;
  logoBase64: string | null;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  accentColor: "#946F1F",
  inkColor: null,
  appName: "Cumulus Bank",
  logoBase64: null,
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
