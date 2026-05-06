// Server-side only — uses Node fetch + Buffer

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  all: string[];
}

export interface BrandFonts {
  heading: string | null;
  body: string | null;
  headingImportUrl: string | null;
  bodyImportUrl: string | null;
}

export interface BrandResult {
  companyName: string | null;
  logo: string | null;          // data URI
  logoUrl: string | null;       // original URL for display
  colors: BrandColors;
  fonts: BrandFonts;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function resolveUrl(base: string, href: string): string | null {
  if (!href || href.startsWith("data:")) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** Fetch with a timeout, returning null on error. */
async function safeFetch(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BrandExtractor/1.0)" },
      redirect: "follow",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const res = await safeFetch(url, timeoutMs);
  if (!res) return null;
  try { return await res.text(); } catch { return null; }
}

async function fetchBase64(url: string, timeoutMs = 8000): Promise<string | null> {
  const res = await safeFetch(url, timeoutMs);
  if (!res) return null;
  try {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 512 * 1024) return null;  // skip empty or >512KB
    const ct = res.headers.get("content-type") ?? "image/png";
    const mimeType = ct.split(";")[0].trim();
    // Only accept image types
    if (!mimeType.startsWith("image/")) return null;
    return `data:${mimeType};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

// ── Color extraction ───────────────────────────────────────────────────────────

const HEX6_RE = /#([0-9a-fA-F]{6})\b/g;
const HEX3_RE = /#([0-9a-fA-F]{3})\b/g;
const RGB_RE  = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

function hex3to6(h3: string): string {
  return `#${h3[0]}${h3[0]}${h3[1]}${h3[1]}${h3[2]}${h3[2]}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** True if the color is essentially white, black, or a gray. */
function isNeutral(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * (max + min) / 2 - 255));
  // Very dark, very light, or very desaturated
  return lightness < 0.08 || lightness > 0.92 || saturation < 0.08;
}

function extractColorsFromCss(css: string): string[] {
  const freq = new Map<string, number>();

  const addColor = (hex: string) => {
    if (!isNeutral(hex)) {
      const normalized = hex.toLowerCase();
      freq.set(normalized, (freq.get(normalized) ?? 0) + 1);
    }
  };

  // hex 6-digit
  for (const m of css.matchAll(HEX6_RE)) addColor(`#${m[1]}`);
  // hex 3-digit
  for (const m of css.matchAll(HEX3_RE)) addColor(hex3to6(m[1]));
  // rgb/rgba
  for (const m of css.matchAll(RGB_RE)) addColor(rgbToHex(+m[1], +m[2], +m[3]));

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([hex]) => hex);
}

/** Extract CSS custom property value: --primary-color, --brand-color, --color-primary, etc. */
function extractCssVarColor(css: string): string | null {
  const varNames = [
    "--primary-color", "--brand-color", "--color-primary", "--brand-primary",
    "--main-color", "--theme-color", "--accent-color", "--color-brand",
  ];
  for (const v of varNames) {
    const re = new RegExp(`${v.replace(/--/, "--")}\\s*:\\s*(#[0-9a-fA-F]{3,6}|rgb[^;)]+)`, "i");
    const m = css.match(re);
    if (m) {
      const raw = m[1].trim();
      if (raw.startsWith("#")) return raw.length === 4 ? hex3to6(raw.slice(1)) : raw;
    }
  }
  return null;
}

// ── Font extraction ────────────────────────────────────────────────────────────

const GOOGLE_FONT_RE = /https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)>]+/g;
const FONT_FAMILY_RE = /font-family\s*:\s*['"]?([^;,'"]+)/gi;
const HEADING_TAGS = ["h1", "h2", "h3", "h4"];

function extractFonts(css: string, html: string): BrandFonts {
  const googleImports = [...css.matchAll(GOOGLE_FONT_RE)].map(m => m[0]);
  // Also check HTML link tags
  const linkHrefs = [...html.matchAll(/href=["']([^"']+fonts\.googleapis\.com[^"']+)["']/gi)].map(m => m[1]);
  const allImports = [...new Set([...googleImports, ...linkHrefs])];

  // Extract font names from Google Fonts URLs
  function fontNameFromUrl(url: string): string | null {
    const m = url.match(/family=([^&:+|]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/\+/g, " ").split("|")[0].split(":")[0].trim();
  }

  // Extract heading font from CSS rules for h1–h4
  let headingFont: string | null = null;
  for (const tag of HEADING_TAGS) {
    const blockRe = new RegExp(`${tag}\\s*\\{([^}]+)\\}`, "gi");
    for (const bm of css.matchAll(blockRe)) {
      const ffm = bm[1].match(FONT_FAMILY_RE);
      if (ffm) {
        headingFont = ffm[0].replace(/font-family\s*:\s*/i, "").replace(/['"]/g, "").split(",")[0].trim();
        break;
      }
    }
    if (headingFont) break;
  }

  // Extract body font from body / :root rule
  const bodyBlockRe = /(?:body|:root)\s*\{([^}]+)\}/gi;
  let bodyFont: string | null = null;
  for (const bm of css.matchAll(bodyBlockRe)) {
    const ffm = bm[1].match(FONT_FAMILY_RE);
    if (ffm) {
      bodyFont = ffm[0].replace(/font-family\s*:\s*/i, "").replace(/['"]/g, "").split(",")[0].trim();
      break;
    }
  }

  // Fall back to Google Fonts names
  if (!headingFont && allImports.length > 0) headingFont = fontNameFromUrl(allImports[0]);
  if (!bodyFont && allImports.length > 1) bodyFont = fontNameFromUrl(allImports[1]);
  if (!bodyFont && allImports.length > 0) bodyFont = headingFont;

  // Match import URLs to font names
  const headingImportUrl = headingFont
    ? allImports.find(u => u.toLowerCase().includes(headingFont!.toLowerCase().replace(/ /g, "+"))) ?? allImports[0] ?? null
    : null;
  const bodyImportUrl = bodyFont && bodyFont !== headingFont
    ? allImports.find(u => u.toLowerCase().includes(bodyFont!.toLowerCase().replace(/ /g, "+"))) ?? null
    : null;

  return {
    heading: headingFont,
    body: bodyFont,
    headingImportUrl,
    bodyImportUrl,
  };
}

// ── Logo extraction ────────────────────────────────────────────────────────────

function extractLogoUrls(html: string, baseUrl: string): string[] {
  const candidates: Array<{ url: string; score: number }> = [];

  const add = (href: string | null, score: number) => {
    const resolved = href ? resolveUrl(baseUrl, href) : null;
    if (resolved) candidates.push({ url: resolved, score });
  };

  // SVG favicon (highest priority)
  for (const m of html.matchAll(/<link[^>]+>/gi)) {
    const tag = m[0];
    const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const type = tag.match(/type=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
    if (rel.includes("icon") && type === "image/svg+xml") add(href, 100);
    else if (rel === "shortcut icon" || rel === "icon") add(href, 50);
    else if (rel === "apple-touch-icon") add(href, 40);
  }

  // og:image
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (ogImage) add(ogImage, 70);

  // <img> with logo in class/id/alt/src
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1] ?? null;
    const cls = tag.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
    const id  = tag.match(/id=["']([^"']+)["']/i)?.[1] ?? "";
    const alt = tag.match(/alt=["']([^"']+)["']/i)?.[1] ?? "";
    const isLogo = [cls, id, alt, src ?? ""].some(s => /logo/i.test(s));
    if (isLogo && src) add(src, 60);
  }

  // Fallback: /favicon.ico
  try {
    const origin = new URL(baseUrl).origin;
    candidates.push({ url: `${origin}/favicon.ico`, score: 10 });
  } catch {}

  // Sort by score desc, deduplicate
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(c => { const key = c.url; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(c => c.url);
}

// ── Company name extraction ────────────────────────────────────────────────────

const NOISE_SUFFIXES = [
  /\s*[|–—-]\s*.+$/, // "Acme | Home", "Acme - Official Site"
  /\s*::\s*.+$/,
  /\s*·\s*.+$/,
  /\s*official\s+(?:site|website|homepage)/i,
  /\s+home\s*$/i,
  /\s+homepage\s*$/i,
];

function cleanCompanyName(raw: string): string {
  let name = raw.trim();
  for (const re of NOISE_SUFFIXES) name = name.replace(re, "").trim();
  return name.slice(0, 40);
}

function extractCompanyName(html: string): string | null {
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
  if (ogSite) return cleanCompanyName(ogSite);

  const appName = html.match(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']application-name["']/i)?.[1];
  if (appName) return cleanCompanyName(appName);

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (title) return cleanCompanyName(title);

  return null;
}

// ── Main extraction ────────────────────────────────────────────────────────────

export async function extractBrand(inputUrl: string): Promise<BrandResult> {
  // Normalise URL
  let baseUrl: string;
  try {
    const u = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    baseUrl = u.href;
  } catch {
    throw new Error("Invalid URL");
  }

  const html = await fetchText(baseUrl, 10_000);
  if (!html) throw new Error("Could not fetch the URL. Check it is publicly accessible.");

  // ── Company name ────────────────────────────────────────────────────────────
  const companyName = extractCompanyName(html);

  // ── Collect CSS ─────────────────────────────────────────────────────────────
  const cssChunks: string[] = [];

  // Inline <style> blocks
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    cssChunks.push(m[1]);
  }

  // Linked stylesheets (up to 3 to stay fast)
  const sheetHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)]
    .map(m => resolveUrl(baseUrl, m[1]))
    .filter((u): u is string => u !== null)
    .slice(0, 3);

  await Promise.all(sheetHrefs.map(async (href) => {
    const css = await fetchText(href, 6_000);
    if (css) cssChunks.push(css);
  }));

  const fullCss = cssChunks.join("\n");

  // ── Colors ──────────────────────────────────────────────────────────────────
  const cssVarColor = extractCssVarColor(fullCss);
  const freqColors  = extractColorsFromCss(fullCss);

  const primary   = cssVarColor ?? freqColors[0] ?? null;
  const secondary = freqColors.find(c => c !== primary) ?? freqColors[1] ?? null;
  const accent    = freqColors.find(c => c !== primary && c !== secondary) ?? freqColors[2] ?? null;
  const allColors = [...new Set([primary, secondary, accent, ...freqColors].filter((c): c is string => c !== null))].slice(0, 8);

  // ── Fonts ───────────────────────────────────────────────────────────────────
  const fonts = extractFonts(fullCss, html);

  // ── Logo ────────────────────────────────────────────────────────────────────
  const logoUrls = extractLogoUrls(html, baseUrl);
  let logo: string | null = null;
  let logoUrl: string | null = null;

  for (const url of logoUrls) {
    const b64 = await fetchBase64(url, 6_000);
    if (b64) {
      logo = b64;
      logoUrl = url;
      break;
    }
  }

  return {
    companyName,
    logo,
    logoUrl,
    colors: { primary, secondary, accent, all: allColors },
    fonts,
  };
}
