export interface Palette {
  accent:   string;
  paper:    string;
  text:     string;
  headerBg: string;
  headerFg: string;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const norm = c / 255;
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns the appropriate text color to render on top of a brand-colored
 * surface. Uses WCAG relative luminance — not just HSL lightness — so
 * saturated colors like PNC orange (L≈55% but high luminance) get dark text.
 */
export function brandForegroundOn(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#F4F1EA";
  return relativeLuminance(hex) > 0.45 ? "#1B1F2A" : "#F4F1EA";
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  function hueToRgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  let r: number, g: number, b: number;
  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hueToRgb(p, q, hNorm + 1 / 3);
    g = hueToRgb(p, q, hNorm);
    b = hueToRgb(p, q, hNorm - 1 / 3);
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Derives the "deep" variant of an ink color — slightly darker, used for
 * secondary dark surfaces like code blocks. Reduces HSL lightness by 6 pp, floored at 4%.
 */
export function inkDeepFromInk(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h, s, l: Math.max(4, l - 6) });
}

/**
 * Returns a darker, readable variant of the accent suitable for text on a
 * light background. Targets WCAG AA contrast (≥4.5:1).
 */
export function deriveAccentTextColor(accentHex: string, paperBgHex = "#FAF7EE"): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(accentHex)) return accentHex;
  const { h, s, l } = hexToHsl(accentHex);
  const newS = Math.min(100, s + 12);
  const paperLum = relativeLuminance(paperBgHex);

  let newL = l;
  while (newL > 5) {
    const candidate = hslToHex({ h, s: newS, l: newL });
    const candLum = relativeLuminance(candidate);
    const lighter = Math.max(candLum, paperLum);
    const darker  = Math.min(candLum, paperLum);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    if (ratio >= 4.5) return candidate;
    newL -= 2;
  }
  return hslToHex({ h, s: newS, l: 12 });
}

/**
 * Returns a brand accent color readable against a dark background.
 * If the color is already light enough (L >= 55%), returns it unchanged.
 * Otherwise lifts lightness to 65% and lowers saturation slightly.
 */
export function brandAccentForDarkMode(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const hsl = hexToHsl(hex);
  if (hsl.l >= 55) return hex;
  return hslToHex({
    h: hsl.h,
    s: Math.max(40, hsl.s - 15),
    l: 65,
  });
}

/**
 * Applies brand palette tokens to the document root, theme-aware.
 *
 * LIGHT MODE: full palette applied — paper, text, header bg/fg all from palette.
 *
 * DARK MODE: only the accent carries through. The dark theme has one consistent
 * look (dark surfaces, light text, dark header) across all customers — the accent
 * color is the sole brand element. All surface/header inline overrides are removed
 * so the [data-theme="dark"] CSS defaults take over cleanly.
 * The accent is dark-adapted so navy/dark colors remain visible on dark backgrounds.
 */
export function applyBrandTokens(accent: string, palette: Palette): void {
  const root = document.documentElement;
  const isDark = typeof document !== "undefined"
    && root.getAttribute("data-theme") === "dark";

  if (!isDark) {
    // Light mode: full palette
    const darkAdapted = brandAccentForDarkMode(accent);
    root.style.setProperty("--color-accent",            accent);
    root.style.setProperty("--color-accent-on-dark",    darkAdapted);
    root.style.setProperty("--color-accent-foreground", brandForegroundOn(accent));
    root.style.setProperty("--color-accent-text",       deriveAccentTextColor(accent, palette.paper));
    root.style.setProperty("--color-paper",             palette.paper);
    root.style.setProperty("--color-text",              palette.text);
    root.style.setProperty("--color-ink",               palette.text);
    root.style.setProperty("--color-ink-deep",          inkDeepFromInk(palette.text));
    root.style.setProperty("--color-header-bg",         palette.headerBg);
    root.style.setProperty("--color-header-fg",         palette.headerFg);
  } else {
    // Dark mode: accent only — use dark-adapted variant so dark brand colors stay visible
    const darkAccent = brandAccentForDarkMode(accent);
    root.style.setProperty("--color-accent",            darkAccent);
    root.style.setProperty("--color-accent-on-dark",    darkAccent);
    root.style.setProperty("--color-accent-foreground", brandForegroundOn(darkAccent));
    root.style.setProperty("--color-accent-text",       darkAccent);
    // Remove all surface/header overrides — let [data-theme="dark"] CSS defaults win
    for (const prop of [
      "--color-paper", "--color-text", "--color-ink", "--color-ink-deep",
      "--color-header-bg", "--color-header-fg",
    ]) {
      root.style.removeProperty(prop);
    }
  }
}

/**
 * Legacy wrapper — kept so callers that pass a 2-field palette still work.
 * New callers should use applyBrandTokens with a full Palette.
 */
export function applyAccentTokens(accent: string, legacyPalette?: { ink: string; paper: string }): void {
  if (!legacyPalette) {
    document.documentElement.style.setProperty("--color-accent", accent);
    document.documentElement.style.setProperty("--color-accent-on-dark", brandAccentForDarkMode(accent));
    document.documentElement.style.setProperty("--color-accent-foreground", brandForegroundOn(accent));
    return;
  }
  applyBrandTokens(accent, {
    accent,
    paper:    legacyPalette.paper,
    text:     legacyPalette.ink,
    headerBg: legacyPalette.ink,
    headerFg: legacyPalette.paper,
  });
}

// deriveReadableTextOnLight is no longer needed externally — applyBrandTokens
// uses the text field directly. Kept for backwards compat with any import.
export function deriveReadableTextOnLight(inputHex: string, _paperBgHex = "#FAF7EE"): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(inputHex)) return "#1B1F2A";
  return inputHex;
}
