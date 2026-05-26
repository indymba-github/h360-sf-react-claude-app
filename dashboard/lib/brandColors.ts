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
 *
 * Threshold 0.45: PNC orange (#F58025, L≈0.47) → dark text; everything
 * else in the seeded set falls below → light text.
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
 * Returns a brand accent color readable against a dark background.
 * If the color is already light enough (L >= 55%), returns it unchanged.
 * Otherwise lifts lightness to 65% and lowers saturation slightly so
 * dark navies become sky blues, dark greens become mint, etc.
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
 * Sets both --color-accent and --color-accent-on-dark on the document root.
 * Call this everywhere a brand accent is applied.
 */
export function applyAccentTokens(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--color-accent", hex);
  root.style.setProperty("--color-accent-on-dark", brandAccentForDarkMode(hex));
  root.style.setProperty("--color-accent-foreground", brandForegroundOn(hex));
}
