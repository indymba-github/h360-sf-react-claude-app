import { brandForegroundOn, type Palette } from "./brandColors";
import type { DemoPack } from "./demoPacks";

export interface ExtractedBrandResult {
  companyName: string | null;
  logo: string | null;
  logoUrl: string | null;
  colors: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    all: string[];
  };
  fonts: {
    heading: string | null;
    body: string | null;
  };
}

export interface BrandSettingsPatch {
  accentColor?: string;
  paperColor?: string;
  textColor?: string;
  headerBgColor?: string;
  headerFgColor?: string;
  inkColor?: string;
  displayFont?: string;
  bodyFont?: string;
  appName?: string;
  logoBase64?: string | null;
}

const DEFAULT_ACCENT = "#946F1F";
const DEFAULT_PAPER = "#F4F1EA";
const DEFAULT_TEXT = "#1B1F2A";
const DEFAULT_DISPLAY_FONT = "Source Serif 4";
const DEFAULT_BODY_FONT = "Inter";

function cleanLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 30);
}

function isHex(value: string | null | undefined): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "");
}

export function paletteFromBrandResult(result: ExtractedBrandResult): Palette {
  const primary = isHex(result.colors.primary) ? result.colors.primary : null;
  const accent =
    (isHex(result.colors.accent) ? result.colors.accent : null) ??
    primary ??
    (isHex(result.colors.secondary) ? result.colors.secondary : null) ??
    DEFAULT_ACCENT;
  const headerBg = primary ?? accent;

  return {
    accent,
    paper: DEFAULT_PAPER,
    text: DEFAULT_TEXT,
    headerBg,
    headerFg: brandForegroundOn(headerBg),
  };
}

export function buildBrandSettingsPatch(result: ExtractedBrandResult): BrandSettingsPatch {
  const palette = paletteFromBrandResult(result);
  const patch: BrandSettingsPatch = {
    accentColor: palette.accent,
    paperColor: palette.paper,
    textColor: palette.text,
    headerBgColor: palette.headerBg,
    headerFgColor: palette.headerFg,
    inkColor: palette.headerBg,
  };

  if (result.companyName?.trim()) patch.appName = cleanLabel(result.companyName, "Extracted Brand");
  if (result.logo) patch.logoBase64 = result.logo;
  if (result.fonts.heading) patch.displayFont = result.fonts.heading;
  if (result.fonts.body) patch.bodyFont = result.fonts.body;

  return patch;
}

export function buildPresetFromBrandResult(
  result: ExtractedBrandResult,
  id: string,
  sourceUrl?: string,
): DemoPack {
  const label = cleanLabel(result.companyName, "Extracted Brand");
  const palette = paletteFromBrandResult(result);

  return {
    id,
    label,
    appName: label,
    logoDataUrl: result.logo,
    palette,
    typography: {
      display: result.fonts.heading ?? DEFAULT_DISPLAY_FONT,
      body: result.fonts.body ?? DEFAULT_BODY_FONT,
    },
    description: sourceUrl ? `Extracted from ${sourceUrl}` : "Extracted from website",
    isCustom: true,
  };
}

export function buildServerSettingsPayload(settings: BrandSettingsPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const keys: Array<keyof BrandSettingsPatch> = [
    "accentColor",
    "paperColor",
    "textColor",
    "headerBgColor",
    "headerFgColor",
    "inkColor",
    "displayFont",
    "bodyFont",
    "appName",
    "logoBase64",
  ];

  for (const key of keys) {
    if (key in settings) payload[key] = settings[key];
  }

  return payload;
}
