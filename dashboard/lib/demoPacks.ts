const LS_LIST    = "demoPacks.list";
const LS_VERSION = "demoPacks.version";
const SEEDED_VERSION = "v3-cumulus-only";

export interface DemoPack {
  id: string;
  label: string;
  appName: string;
  logoDataUrl: string | null;
  palette: { accent: string; paper: string; ink: string };
  typography: { display: string; body: string };
  description: string;
  isCustom: boolean;
}

export const SEEDED_PRESETS: DemoPack[] = [
  {
    id: "cumulus",
    label: "Cumulus Bank",
    appName: "Cumulus Bank",
    logoDataUrl: "/demo-packs/cumulus.svg",
    palette: { accent: "#946F1F", paper: "#F4F1EA", ink: "#1B1F2A" },
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
      // Version mismatch — reseed with new banks, preserve user-created customs
      const existingCustoms: DemoPack[] = stored
        ? (JSON.parse(stored) as DemoPack[]).filter((p) => p.isCustom)
        : [];
      const newList = [...SEEDED_PRESETS, ...existingCustoms];
      localStorage.setItem(LS_LIST, JSON.stringify(newList));
      localStorage.setItem(LS_VERSION, SEEDED_VERSION);
      return newList;
    }

    if (stored) return JSON.parse(stored) as DemoPack[];

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
