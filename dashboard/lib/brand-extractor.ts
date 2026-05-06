// Server-side only — uses Node fetch + Buffer
import Anthropic from "@anthropic-ai/sdk";

export type ColorSource = "css" | "ai";

export interface TaggedColor {
  hex: string;
  source: ColorSource;
}

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  all: string[];
  tagged: TaggedColor[];
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
  aiAnalyzed: boolean;
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
    if (buf.length === 0 || buf.length > 512 * 1024) return null;
    const ct = res.headers.get("content-type") ?? "";
    const mimeType = ct.split(";")[0].trim();
    if (!mimeType.startsWith("image/")) return null;
    return `data:${mimeType};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

// ── Color utilities ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Normalize any hex (3, 6, or 8 digit) to lowercase 6-digit. Returns null if invalid. */
function normalizeHex(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s[0] !== "#") return null;
  if (s.length === 4) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  if (s.length === 7) return s;
  if (s.length === 9) return s.slice(0, 7); // 8-digit: strip alpha
  return null;
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** True for near-white (all channels > 230), near-black (all < 40), or near-gray (max spread < 20). */
function isNeutral(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  if (r > 230 && g > 230 && b > 230) return true;
  if (r < 40 && g < 40 && b < 40) return true;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 20) return true;
  return false;
}

function rgbDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function hexToHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return ((h * 60) + 360) % 360;
}

// ── Color extraction from text ────────────────────────────────────────────────

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
const HSL_RE = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/g;

function extractColorsFromText(text: string): Map<string, number> {
  const freq = new Map<string, number>();

  const add = (hex: string) => {
    const norm = normalizeHex(hex);
    if (!norm || isNeutral(norm)) return;
    freq.set(norm, (freq.get(norm) ?? 0) + 1);
  };

  for (const m of [...text.matchAll(HEX_RE)]) {
    if (m[1].length === 3 || m[1].length === 6 || m[1].length === 8) add(`#${m[1]}`);
  }
  for (const m of [...text.matchAll(RGB_RE)]) add(rgbToHex(+m[1], +m[2], +m[3]));
  for (const m of [...text.matchAll(HSL_RE)]) add(hslToHex(+m[1], +m[2], +m[3]));

  return freq;
}

function addFreqMap(target: Map<string, number>, source: Map<string, number>) {
  source.forEach((count, hex) => {
    target.set(hex, (target.get(hex) ?? 0) + count);
  });
}

/**
 * Groups colors within RGB distance 30 and returns the most-frequent
 * representative from each group, sorted by group total frequency.
 */
function groupAndRankColors(freq: Map<string, number>): string[] {
  const entries: [string, number][] = [];
  freq.forEach((count, hex) => entries.push([hex, count]));
  entries.sort((a, b) => b[1] - a[1]);

  const groups: Array<{ rep: string; totalFreq: number }> = [];
  for (const [hex, count] of entries) {
    let placed = false;
    for (const g of groups) {
      if (rgbDistance(hex, g.rep) < 30) { g.totalFreq += count; placed = true; break; }
    }
    if (!placed) groups.push({ rep: hex, totalFreq: count });
  }

  return groups.sort((a, b) => b.totalFreq - a.totalFreq).slice(0, 8).map(g => g.rep);
}

function pickDistinctColors(colors: string[], themeColor: string | null): {
  primary: string | null; secondary: string | null; accent: string | null;
} {
  const ranked = themeColor && !isNeutral(themeColor)
    ? [themeColor, ...colors.filter(c => c !== themeColor)]
    : colors;

  const primary = ranked[0] ?? null;
  if (!primary) return { primary: null, secondary: null, accent: null };

  const primaryHue = hexToHue(primary);
  const secondary = ranked.slice(1).find(c => Math.min(Math.abs(hexToHue(c) - primaryHue), 360 - Math.abs(hexToHue(c) - primaryHue)) > 30)
    ?? ranked[1] ?? null;
  const secondaryHue = secondary ? hexToHue(secondary) : -999;
  const accent = ranked.slice(1).find(c => {
    if (c === secondary) return false;
    const hue = hexToHue(c);
    return Math.min(Math.abs(hue - primaryHue), 360 - Math.abs(hue - primaryHue)) > 30
      && Math.min(Math.abs(hue - secondaryHue), 360 - Math.abs(hue - secondaryHue)) > 30;
  }) ?? ranked.find(c => c !== primary && c !== secondary) ?? null;

  return { primary, secondary, accent };
}

// ── Source-specific extractors ────────────────────────────────────────────────

function extractMetaThemeColor(html: string): string | null {
  const raw = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i)?.[1];
  if (!raw) return null;
  const hex = normalizeHex(raw.trim());
  if (hex) return hex;
  const rgb = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return rgb ? rgbToHex(+rgb[1], +rgb[2], +rgb[3]) : null;
}

function extractInlineStyleColors(html: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const m of [...html.matchAll(/\bstyle=["']([^"']+)["']/gi)]) {
    if (!/color|background|border/i.test(m[1])) continue;
    addFreqMap(freq, extractColorsFromText(m[1]));
  }
  return freq;
}

function extractSvgColors(svgText: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const m of [...svgText.matchAll(/(?:fill|stroke)=["']([^"']+)["']/gi)]) {
    const val = m[1].trim();
    if (val === "none" || val === "currentColor" || val === "inherit") continue;
    addFreqMap(freq, extractColorsFromText(val));
  }
  addFreqMap(freq, extractColorsFromText(svgText));
  return freq;
}

function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  for (const m of [...html.matchAll(/<link[^>]+>/gi)]) {
    const tag = m[0];
    const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (!rel.includes("stylesheet")) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const resolved = resolveUrl(baseUrl, href);
    if (resolved) urls.push(resolved);
  }
  return urls.slice(0, 3);
}

function extractCssVarColor(css: string): string | null {
  const varNames = [
    "--primary-color", "--brand-color", "--color-primary", "--brand-primary",
    "--main-color", "--theme-color", "--accent-color", "--color-brand",
  ];
  for (const v of varNames) {
    const re = new RegExp(`${v}\\s*:\\s*(#[0-9a-fA-F]{3,6}|rgb[^;)]+)`, "i");
    const m = css.match(re);
    if (m) {
      const raw = m[1].trim();
      if (raw.startsWith("#")) return normalizeHex(raw);
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
  const linkHrefs = [...html.matchAll(/href=["']([^"']+fonts\.googleapis\.com[^"']+)["']/gi)].map(m => m[1]);
  const allImports = [...new Set([...googleImports, ...linkHrefs])];

  function fontNameFromUrl(url: string): string | null {
    const m = url.match(/family=([^&:+|]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/\+/g, " ").split("|")[0].split(":")[0].trim();
  }

  let headingFont: string | null = null;
  for (const tag of HEADING_TAGS) {
    const blockRe = new RegExp(`${tag}\\s*\\{([^}]+)\\}`, "gi");
    for (const bm of [...css.matchAll(blockRe)]) {
      const ffm = bm[1].match(FONT_FAMILY_RE);
      if (ffm) {
        headingFont = ffm[0].replace(/font-family\s*:\s*/i, "").replace(/['"]/g, "").split(",")[0].trim();
        break;
      }
    }
    if (headingFont) break;
  }

  const bodyBlockRe = /(?:body|:root)\s*\{([^}]+)\}/gi;
  let bodyFont: string | null = null;
  for (const bm of [...css.matchAll(bodyBlockRe)]) {
    const ffm = bm[1].match(FONT_FAMILY_RE);
    if (ffm) {
      bodyFont = ffm[0].replace(/font-family\s*:\s*/i, "").replace(/['"]/g, "").split(",")[0].trim();
      break;
    }
  }

  if (!headingFont && allImports.length > 0) headingFont = fontNameFromUrl(allImports[0]);
  if (!bodyFont && allImports.length > 1) bodyFont = fontNameFromUrl(allImports[1]);
  if (!bodyFont && allImports.length > 0) bodyFont = headingFont;

  const headingImportUrl = headingFont
    ? allImports.find(u => u.toLowerCase().includes(headingFont!.toLowerCase().replace(/ /g, "+"))) ?? allImports[0] ?? null
    : null;
  const bodyImportUrl = bodyFont && bodyFont !== headingFont
    ? allImports.find(u => u.toLowerCase().includes(bodyFont!.toLowerCase().replace(/ /g, "+"))) ?? null
    : null;

  return { heading: headingFont, body: bodyFont, headingImportUrl, bodyImportUrl };
}

// ── Logo extraction ────────────────────────────────────────────────────────────

function extractLogoUrls(html: string, baseUrl: string): string[] {
  const candidates: Array<{ url: string; score: number }> = [];

  const add = (href: string | null, score: number) => {
    const resolved = href ? resolveUrl(baseUrl, href) : null;
    if (resolved) candidates.push({ url: resolved, score });
  };

  for (const m of [...html.matchAll(/<link[^>]+>/gi)]) {
    const tag = m[0];
    const rel  = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const type = tag.match(/type=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
    if (rel.includes("icon") && type === "image/svg+xml") add(href, 100);
    else if (rel === "shortcut icon" || rel === "icon") add(href, 50);
    else if (rel === "apple-touch-icon") add(href, 40);
  }

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (ogImage) add(ogImage, 70);

  for (const m of [...html.matchAll(/<img[^>]+>/gi)]) {
    const tag = m[0];
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1] ?? null;
    const cls = tag.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
    const id  = tag.match(/id=["']([^"']+)["']/i)?.[1] ?? "";
    const alt = tag.match(/alt=["']([^"']+)["']/i)?.[1] ?? "";
    if ([cls, id, alt, src ?? ""].some(s => /logo/i.test(s)) && src) add(src, 60);
  }

  try {
    const origin = new URL(baseUrl).origin;
    candidates.push({ url: `${origin}/favicon.ico`, score: 10 });
  } catch {}

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(c => { if (seen.has(c.url)) return false; seen.add(c.url); return true; })
    .map(c => c.url);
}

// ── Company name extraction ────────────────────────────────────────────────────

const NOISE_SUFFIXES = [
  /\s*[|–—-]\s*.+$/,
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

// ── AI-based brand analysis ───────────────────────────────────────────────────

interface AiAnalysisResult {
  primary: string | null;
  secondary: string | null;
  additional: string[];
  headingFont: string | null;
  bodyFont: string | null;
}

async function analyzeWithAI(logoBase64: string | null, html: string): Promise<AiAnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const anthropic = new Anthropic({ apiKey });

  const jsonInstruction = `Respond ONLY with JSON, no markdown, no backticks:
{
  "primary": "#hex or null",
  "secondary": "#hex or null",
  "additional": ["#hex"],
  "headingFont": "Font Name or null",
  "bodyFont": "Font Name or null"
}`;

  const htmlSnippet = html.slice(0, logoBase64 ? 5000 : 8000);

  let content: Anthropic.MessageParam["content"];

  if (logoBase64 && logoBase64.startsWith("data:image/")) {
    // Extract media type and base64 data
    const mediaMatch = logoBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!mediaMatch) return null;
    const mediaType = mediaMatch[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    // Claude vision only supports png/jpeg/gif/webp — skip svg
    const supported = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!supported.includes(mediaType)) {
      // Fall back to text-only with SVG excluded
      content = [{
        type: "text",
        text: `Analyze this website HTML and extract brand colors. Look at inline styles, CSS color values, meta theme-color tags, and color class names. Also identify font-family declarations.\n\n${jsonInstruction}\n\nHTML:\n${htmlSnippet}`,
      }];
    } else {
      content = [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: mediaMatch[2] },
        },
        {
          type: "text",
          text: `Analyze this company logo and the following HTML from their website. Extract the brand identity:\n\n1. PRIMARY COLOR: The single most dominant brand color (hex code). Look at the logo colors, header backgrounds, and primary buttons.\n2. SECONDARY COLOR: The second brand color (hex code). Look at accents, links, and secondary elements.\n3. ADDITIONAL COLORS: Up to 3 more brand colors (hex codes).\n4. HEADING FONT: The font used for headings (name only, or null if unclear).\n5. BODY FONT: The font used for body text (name only, or null if unclear).\n\n${jsonInstruction}\n\nPage HTML (first ${htmlSnippet.length} chars):\n${htmlSnippet}`,
        },
      ];
    }
  } else {
    content = [{
      type: "text",
      text: `Analyze this website HTML and extract brand colors. Look at inline styles, CSS color values, meta theme-color tags, background-color declarations, and any color values in style attributes.\n\n${jsonInstruction}\n\nHTML:\n${htmlSnippet}`,
    }];
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [{ role: "user", content }],
      }, { signal: controller.signal as RequestInit["signal"] });
    } finally {
      clearTimeout(timer);
    }

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    console.log("AI brand analysis response:", text.slice(0, 200));

    // Try to parse JSON directly
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Claude sometimes wraps in markdown — strip it
      const stripped = text.replace(/```[a-z]*\n?/gi, "").trim();
      try {
        parsed = JSON.parse(stripped) as Record<string, unknown>;
      } catch {
        // Last resort: pull hex codes out with regex
        const hexes = [...stripped.matchAll(/"#([0-9a-fA-F]{6})"/g)].map(m => `#${m[1]}`);
        if (hexes.length === 0) return null;
        return { primary: hexes[0] ?? null, secondary: hexes[1] ?? null, additional: hexes.slice(2, 5), headingFont: null, bodyFont: null };
      }
    }

    const toHex = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const n = normalizeHex(v.trim());
      return n && !isNeutral(n) ? n : null;
    };

    const additional: string[] = (Array.isArray(parsed.additional) ? parsed.additional : [])
      .map(toHex)
      .filter((h): h is string => h !== null);

    return {
      primary: toHex(parsed.primary),
      secondary: toHex(parsed.secondary),
      additional,
      headingFont: typeof parsed.headingFont === "string" && parsed.headingFont !== "null" ? parsed.headingFont : null,
      bodyFont: typeof parsed.bodyFont === "string" && parsed.bodyFont !== "null" ? parsed.bodyFont : null,
    };
  } catch (err) {
    console.warn("AI brand analysis failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Main extraction ────────────────────────────────────────────────────────────

export async function extractBrand(inputUrl: string): Promise<BrandResult> {
  let baseUrl: string;
  try {
    const u = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    baseUrl = u.href;
  } catch {
    throw new Error("Invalid URL");
  }

  const html = await fetchText(baseUrl, 10_000);
  if (!html) throw new Error("Could not fetch the URL. Check it is publicly accessible.");

  const companyName = extractCompanyName(html);

  // Meta theme-color is the most explicit brand signal
  const themeColor = extractMetaThemeColor(html);
  console.log("Meta theme-color:", themeColor);

  // Style tags
  const styleTagTexts: string[] = [];
  for (const m of [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]) {
    styleTagTexts.push(m[1]);
  }
  const styleTagCss = styleTagTexts.join("\n");
  const styleColors = extractColorsFromText(styleTagCss);
  console.log("Colors from style tags:", styleColors.size);

  // Linked stylesheets (up to 3)
  const sheetUrls = extractStylesheetUrls(html, baseUrl);
  const sheetTexts = (await Promise.all(sheetUrls.map(u => fetchText(u, 6_000)))).filter((t): t is string => t !== null);
  const sheetCss = sheetTexts.join("\n");
  const sheetColors = extractColorsFromText(sheetCss);
  console.log("Colors from stylesheets:", sheetColors.size);

  // Inline style attributes
  const inlineColors = extractInlineStyleColors(html);
  console.log("Colors from inline styles:", inlineColors.size);

  // Fonts (needs combined CSS)
  const fullCss = [styleTagCss, sheetCss].join("\n");
  const fonts = extractFonts(fullCss, html);

  // Logo + SVG color extraction
  const logoUrls = extractLogoUrls(html, baseUrl);
  let logo: string | null = null;
  let logoUrl: string | null = null;
  let svgColors = new Map<string, number>();

  for (const url of logoUrls) {
    if (/\.svg($|\?)/i.test(url) || url.includes("svg")) {
      const svgText = await fetchText(url, 6_000);
      if (svgText && /<svg/i.test(svgText)) {
        svgColors = extractSvgColors(svgText);
        logo = `data:image/svg+xml;base64,${Buffer.from(svgText).toString("base64")}`;
        logoUrl = url;
        break;
      }
    }
    const b64 = await fetchBase64(url, 6_000);
    if (b64) {
      logo = b64;
      logoUrl = url;
      if (b64.startsWith("data:image/svg+xml;base64,")) {
        try {
          const svgText = Buffer.from(b64.split(",")[1], "base64").toString("utf-8");
          svgColors = extractSvgColors(svgText);
        } catch {}
      }
      break;
    }
  }

  // Merge all color sources
  const allFreq = new Map<string, number>();
  addFreqMap(allFreq, styleColors);
  addFreqMap(allFreq, sheetColors);
  addFreqMap(allFreq, inlineColors);
  addFreqMap(allFreq, svgColors);

  // Boost CSS variable colors — they're intentionally set
  const cssVarColor = extractCssVarColor(fullCss);
  if (cssVarColor) {
    const norm = normalizeHex(cssVarColor);
    if (norm && !isNeutral(norm)) allFreq.set(norm, (allFreq.get(norm) ?? 0) + 10);
  }

  // Heavy boost for theme-color — most explicit brand signal
  if (themeColor && !isNeutral(themeColor)) {
    allFreq.set(themeColor, (allFreq.get(themeColor) ?? 0) + 20);
  }

  console.log("All colors found:", allFreq.size);

  const ranked = groupAndRankColors(allFreq);
  const cssColors = ranked.slice(0, 5);
  console.log("Filtered brand colors (CSS):", cssColors);

  // ── AI analysis (always runs to supplement CSS, but CSS vars/theme-color take priority) ──
  const aiResult = await analyzeWithAI(logo, html);
  let aiAnalyzed = false;

  // Build tagged color list: CSS colors first, then AI-only colors
  const taggedColors: TaggedColor[] = cssColors.map(hex => ({ hex, source: "css" as ColorSource }));

  if (aiResult) {
    aiAnalyzed = true;
    console.log("AI analysis result:", aiResult);
    const aiHexes = [
      aiResult.primary,
      aiResult.secondary,
      ...aiResult.additional,
    ].filter((h): h is string => h !== null);

    for (const hex of aiHexes) {
      // Add AI color if not already close to an existing CSS color
      const alreadyCovered = taggedColors.some(t => rgbDistance(t.hex, hex) < 30);
      if (!alreadyCovered) taggedColors.push({ hex, source: "ai" });
    }

    // Fill fonts from AI if CSS didn't find them
    if (!fonts.heading && aiResult.headingFont) fonts.heading = aiResult.headingFont;
    if (!fonts.body && aiResult.bodyFont) fonts.body = aiResult.bodyFont;

    // If CSS found no colors, boost AI primary/secondary into the allFreq so
    // pickDistinctColors can use them
    if (cssColors.length === 0) {
      if (aiResult.primary) allFreq.set(aiResult.primary, 15);
      if (aiResult.secondary) allFreq.set(aiResult.secondary, 10);
      for (const h of aiResult.additional) allFreq.set(h, 5);
    }
  }

  const allColors = taggedColors.slice(0, 8).map(t => t.hex);
  const finalFreq = allFreq.size > 0 ? allFreq : new Map(allColors.map((h, i) => [h, 8 - i]));
  const { primary, secondary, accent } = pickDistinctColors(
    groupAndRankColors(finalFreq),
    themeColor,
  );

  return {
    companyName,
    logo,
    logoUrl,
    colors: { primary, secondary, accent, all: allColors, tagged: taggedColors.slice(0, 8) },
    fonts,
    aiAnalyzed,
  };
}
