"use client";

import { applyAccentTokens, applyBrandTokens } from "./brandColors";
import { migratePalette } from "./demoPacks";
import { buildServerSettingsPayload, type BrandSettingsPatch } from "./brand-settings";

export const LS_SETTINGS = "settings";

export interface StoredSettings extends BrandSettingsPatch {
  trustLayerModel?: string | null;
}

interface WriteOptions {
  replace?: boolean;
}

interface PersistBrandingOptions extends WriteOptions {
  applyLive?: boolean;
  persistServer?: boolean;
  brandingEvent?: "changed" | "reset" | "none";
  themeChanged?: boolean;
}

const DEFAULT_PAPER = "#F4F1EA";
const DEFAULT_TEXT = "#1B1F2A";

export function readStoredSettings(): StoredSettings {
  try {
    return JSON.parse(localStorage.getItem(LS_SETTINGS) ?? "{}") as StoredSettings;
  } catch {
    return {};
  }
}

export function writeStoredSettings(patch: Partial<StoredSettings>, options: WriteOptions = {}): StoredSettings {
  const next = options.replace ? { ...patch } : { ...readStoredSettings(), ...patch };
  localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
  return next as StoredSettings;
}

export function loadGoogleFont(fontName: string) {
  if (fontName === "system-ui" || fontName === "Inter") return;
  const family = fontName.replace(/ /g, "+");
  const id = `gf-${family}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,400;0,500;1,400&display=swap`;
  document.head.appendChild(link);
}

function applyFontVar(name: string, kind: "display" | "body") {
  loadGoogleFont(name);
  const fallback = kind === "display" ? "serif" : "sans-serif";
  const family = name === "system-ui" ? "system-ui, sans-serif" : `, ${fallback}`;
  document.documentElement.style.setProperty(`--font-${kind}`, family);
}

export function applyBrandingSettings(settings: Partial<StoredSettings>) {
  if (settings.accentColor) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (!isDark) {
      const legacyInk = settings.inkColor ?? DEFAULT_TEXT;
      applyBrandTokens(settings.accentColor, migratePalette({
        accent: settings.accentColor,
        paper: settings.paperColor ?? DEFAULT_PAPER,
        text: settings.textColor ?? legacyInk,
        headerBg: settings.headerBgColor ?? legacyInk,
        headerFg: settings.headerFgColor ?? (settings.paperColor ?? DEFAULT_PAPER),
      }));
    } else {
      applyAccentTokens(settings.accentColor);
    }
  }

  if (settings.displayFont) applyFontVar(settings.displayFont, "display");
  if (settings.bodyFont) applyFontVar(settings.bodyFont, "body");
}

export function applyStoredBrandingSettings() {
  applyBrandingSettings(readStoredSettings());
}

export async function postBrandingSettings(settings: Partial<StoredSettings>): Promise<boolean> {
  const payload = buildServerSettingsPayload(settings);
  if (Object.keys(payload).length === 0) return true;

  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

export function notifyBrandingChanged(options: Pick<PersistBrandingOptions, "brandingEvent" | "themeChanged"> = {}) {
  const brandingEvent = options.brandingEvent ?? "changed";
  if (brandingEvent === "changed") window.dispatchEvent(new CustomEvent("branding-changed"));
  if (brandingEvent === "reset") window.dispatchEvent(new CustomEvent("branding-reset"));
  if (options.themeChanged ?? true) window.dispatchEvent(new CustomEvent("theme-changed"));
}

export async function persistBrandingSettings(
  patch: Partial<StoredSettings>,
  options: PersistBrandingOptions = {},
): Promise<{ settings: StoredSettings; serverSaved: boolean }> {
  const settings = writeStoredSettings(patch, { replace: options.replace });

  if (options.applyLive ?? true) applyBrandingSettings(settings);

  const serverSaved = options.persistServer === false
    ? true
    : await postBrandingSettings(patch);

  if (options.brandingEvent !== "none") {
    notifyBrandingChanged({
      brandingEvent: options.brandingEvent,
      themeChanged: options.themeChanged,
    });
  }

  return { settings, serverSaved };
}
