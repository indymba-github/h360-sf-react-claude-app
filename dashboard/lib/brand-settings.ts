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
    tagged?: Array<{ hex: string; source?: string }>;
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

function labelFromSourceUrl(sourceUrl?: string): string | null {
  if (!sourceUrl?.trim()) return null;
  try {
    const url = new URL(sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`);
    const hostParts = url.hostname.replace(/^www\./i, "").split(".").filter(Boolean);
    const base = hostParts[0];
    if (!base) return null;
    return base
      .split(/[-_]/)
      .filter(Boolean)
      .map((word) => word.length <= 3 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`)
      .join(" ")
      .slice(0, 30);
  } catch {
    return null;
  }
}

export function deriveBrandLabel(result: ExtractedBrandResult, sourceUrl?: string): string {
  return cleanLabel(result.companyName, labelFromSourceUrl(sourceUrl) ?? "Extracted Brand");
}

export function getDisplayBrandColors(result: ExtractedBrandResult): string[] {
  const candidates = [
    result.colors.primary,
    result.colors.secondary,
    result.colors.accent,
    ...result.colors.all,
    ...(result.colors.tagged?.map((color) => color.hex) ?? []),
  ];
  const seen = new Set<string>();
  return candidates.filter((color): color is string => {
    if (!isHex(color)) return false;
    const normalized = color.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export interface BrandExtractionSummary {
  displayName: string;
  colors: string[];
  fonts: string[];
  hasSaveableLogo: boolean;
  hasLogoUrlOnly: boolean;
  hasThemeDetails: boolean;
}

export function summarizeBrandExtraction(
  result: ExtractedBrandResult,
  sourceUrl?: string,
): BrandExtractionSummary {
  const colors = getDisplayBrandColors(result);
  const fonts = [result.fonts.heading, result.fonts.body].filter((font): font is string => Boolean(font));
  const hasSaveableLogo = Boolean(result.logo);
  const hasLogoUrlOnly = Boolean(!result.logo && result.logoUrl);

  return {
    displayName: deriveBrandLabel(result, sourceUrl),
    colors,
    fonts,
    hasSaveableLogo,
    hasLogoUrlOnly,
    hasThemeDetails: colors.length > 0 || hasSaveableLogo || fonts.length > 0,
  };
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

export function buildBrandSettingsPatch(result: ExtractedBrandResult, sourceUrl?: string): BrandSettingsPatch {
  const patch: BrandSettingsPatch = {
    appName: deriveBrandLabel(result, sourceUrl),
  };

  if (getDisplayBrandColors(result).length > 0) {
    const palette = paletteFromBrandResult(result);
    patch.accentColor = palette.accent;
    patch.paperColor = palette.paper;
    patch.textColor = palette.text;
    patch.headerBgColor = palette.headerBg;
    patch.headerFgColor = palette.headerFg;
    patch.inkColor = palette.headerBg;
  }

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
  const label = deriveBrandLabel(result, sourceUrl);
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


export function buildPresetSettingsPatch(preset: DemoPack): BrandSettingsPatch {
  return {
    accentColor: preset.palette.accent,
    paperColor: preset.palette.paper,
    textColor: preset.palette.text,
    headerBgColor: preset.palette.headerBg,
    headerFgColor: preset.palette.headerFg,
    inkColor: preset.palette.headerBg,
    displayFont: preset.typography.display,
    bodyFont: preset.typography.body,
    appName: preset.appName,
    logoBase64: preset.logoDataUrl,
  };
}

function normalizePresetLabel(value: string | null | undefined, sourceUrl?: string): string {
  return cleanLabel(value, labelFromSourceUrl(sourceUrl) ?? "Extracted Brand").toLowerCase();
}

export function findMatchingBrandPreset(
  presets: DemoPack[],
  result: ExtractedBrandResult,
  sourceUrl?: string,
): DemoPack | null {
  const label = normalizePresetLabel(result.companyName, sourceUrl);
  return presets.find((preset) => preset.isCustom && preset.label.trim().toLowerCase() === label) ?? null;
}

export interface BrandPresetUpsertResult {
  action: "created" | "updated";
  preset: DemoPack;
  presets: DemoPack[];
}

export function upsertBrandPreset(
  presets: DemoPack[],
  result: ExtractedBrandResult,
  newId: string,
  sourceUrl?: string,
): BrandPresetUpsertResult {
  const replacement = buildPresetFromBrandResult(result, newId, sourceUrl);
  const existing = findMatchingBrandPreset(presets, result, sourceUrl);

  if (!existing) {
    return {
      action: "created",
      preset: replacement,
      presets: [...presets, replacement],
    };
  }

  const updated: DemoPack = {
    ...replacement,
    id: existing.id,
    isCustom: true,
  };

  return {
    action: "updated",
    preset: updated,
    presets: presets.map((preset) => preset.id === existing.id ? updated : preset),
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
