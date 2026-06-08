import type { Palette } from "./brandColors";
export type { Palette };  // re-export so existing imports from demoPacks still work

const LS_LIST    = "demoPacks.list";
const LS_VERSION = "demoPacks.version";
const SEEDED_VERSION = "v4-5field-palette";

export interface DemoPack {
  id: string;
  label: string;
  appName: string;
  logoDataUrl: string | null;
  palette: Palette;
  typography: { display: string; body: string };
  description: string;
  isCustom: boolean;
}

/**
 * Migrate a legacy palette (with `ink` field) to the new 5-field shape.
 * - text     = ink (body text rendered the same as before)
 * - headerBg = ink (header rendered the same as before)
 * - headerFg = paper (header text contrast preserved)
 */
export function migratePalette(p: Record<string, unknown>): Palette {
  if (p?.text && p?.headerBg && p?.headerFg) return p as unknown as Palette;
  const legacyInk = (p?.ink as string | undefined) ?? "#1B1F2A";
  return {
    accent:   (p?.accent   as string | undefined) ?? "#946F1F",
    paper:    (p?.paper    as string | undefined) ?? "#F4F1EA",
    text:     (p?.text     as string | undefined) ?? legacyInk,
    headerBg: (p?.headerBg as string | undefined) ?? legacyInk,
    headerFg: (p?.headerFg as string | undefined) ?? ((p?.paper as string | undefined) ?? "#F4F1EA"),
  };
}

export const SEEDED_PRESETS: DemoPack[] = [
  {
    id: "cumulus",
    label: "Cumulus Bank",
    appName: "Cumulus Bank",
    logoDataUrl: "/demo-packs/cumulus.svg",
    palette: {
      accent:   "#946F1F",
      paper:    "#F4F1EA",
      text:     "#1B1F2A",
      headerBg: "#1B1F2A",
      headerFg: "#F4F1EA",
    },
    typography: { display: "Source Serif 4", body: "Inter" },
    description: "Default fictional bank — Salesforce demo.",
    isCustom: false,
  },
];

export function getPresets(): DemoPack[] {
  try {
    const storedVersion = localStorage.getItem(LS_VERSION);
    const stored = localStorage.getItem(LS_LIST);

    if (storedVersion !== SEEDED_VERSION) {
      // Version mismatch — reseed, preserve user-created customs (migrate their palettes)
      const existingCustoms: DemoPack[] = stored
        ? (JSON.parse(stored) as DemoPack[]).filter((p) => p.isCustom).map((p) => ({
            ...p,
            palette: migratePalette(p.palette as unknown as Record<string, unknown>),
          }))
        : [];
      const newList = [...SEEDED_PRESETS, ...existingCustoms];
      localStorage.setItem(LS_LIST, JSON.stringify(newList));
      localStorage.setItem(LS_VERSION, SEEDED_VERSION);
      return newList;
    }

    if (stored) {
      return (JSON.parse(stored) as DemoPack[]).map((p) => ({
        ...p,
        palette: migratePalette(p.palette as unknown as Record<string, unknown>),
      }));
    }

    localStorage.setItem(LS_LIST, JSON.stringify(SEEDED_PRESETS));
    localStorage.setItem(LS_VERSION, SEEDED_VERSION);
    return [...SEEDED_PRESETS];
  } catch {
    return [...SEEDED_PRESETS];
  }
}

export function savePresets(presets: DemoPack[]) {
  localStorage.setItem(LS_LIST, JSON.stringify(presets));
}

export function restoreSeeded() {
  const current = getPresets();
  const customs = current.filter((p) => p.isCustom);
  const restored = [...SEEDED_PRESETS, ...customs];
  localStorage.setItem(LS_LIST, JSON.stringify(restored));
  localStorage.setItem(LS_VERSION, SEEDED_VERSION);
}

export function newPresetId(): string {
  return `custom-${Date.now()}`;
}
