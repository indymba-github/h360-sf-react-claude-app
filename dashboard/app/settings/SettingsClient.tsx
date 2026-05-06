"use client";

import { useState, useRef, useEffect } from "react";
import type { AppSettings } from "@/lib/settings";
import type { BrandResult, TaggedColor } from "@/lib/brand-extractor";

// ── Constants / defaults ───────────────────────────────────────────────────────

const DEFAULTS: AppSettings = {
  primaryColor: "#2D5BFF",
  secondaryColor: "#0D9488",
  accentColor: "#F59E0B",
  appName: "SF Dashboard",
  logoBase64: null,
  headingFont: "Inter",
  bodyFont: "Inter",
  headingFontUrl: null,
  bodyFontUrl: null,
  borderRadius: 8,
  sidebarStyle: "dark",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const isValidHex = (v: string) => HEX_RE.test(v);

// ── Small UI helpers ───────────────────────────────────────────────────────────

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = isValidHex(value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-md border border-gray-200 cursor-pointer p-0.5 bg-white"
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={`w-32 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
            valid || value === "" ? "border-gray-200" : "border-red-400"
          }`}
        />
        {valid && <div className="w-8 h-8 rounded-md border border-gray-200 shrink-0" style={{ background: value }} />}
      </div>
    </div>
  );
}

/**
 * Renders a row of color swatches with a single shared popover.
 * Only one swatch can be open at a time; clicking outside closes it.
 */
function ColorSwatchRow({
  colors,
  onSetPrimary,
  onSetSecondary,
  onSetAccent,
}: {
  colors: TaggedColor[];
  onSetPrimary: (c: string) => void;
  onSetSecondary: (c: string) => void;
  onSetAccent: (c: string) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (openIdx === null) return;
    function handler(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setOpenIdx(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openIdx]);

  const ROLE_LABELS = ["primary", "secondary", "accent"];

  return (
    <div ref={rowRef} className="flex flex-wrap gap-3">
      {colors.map((t, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={`${t.hex}-${i}`} className="relative">
            {/* Swatch button */}
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400"
              style={{ background: t.hex }}
              aria-label={`Select color ${t.hex}`}
            />
            {/* Source badge */}
            <span
              className={`absolute -top-1 -right-1 text-[7px] font-bold px-0.5 rounded leading-tight pointer-events-none select-none ${
                t.source === "ai" ? "bg-purple-500 text-white" : "bg-blue-500 text-white"
              }`}
            >
              {t.source === "ai" ? "AI" : "CSS"}
            </span>
            {/* Role label below swatch */}
            {i < 3 && (
              <p className="text-[9px] text-center text-gray-400 mt-0.5">{ROLE_LABELS[i]}</p>
            )}

            {/* Popover — renders below the swatch */}
            {isOpen && (
              <div
                className="absolute z-50 mt-2"
                style={{ top: "100%", left: "50%", transform: "translateX(-50%)" }}
              >
                {/* Caret */}
                <div
                  className="mx-auto mb-[-1px]"
                  style={{
                    width: 0, height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderBottom: "6px solid #E2E8F0",
                    position: "relative", zIndex: 1,
                    left: "50%", transform: "translateX(-50%)",
                  }}
                />
                <div
                  className="bg-white rounded-lg p-3 whitespace-nowrap"
                  style={{
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    minWidth: "160px",
                  }}
                >
                  {/* Color preview + hex */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded shrink-0 border border-gray-100" style={{ background: t.hex }} />
                    <span className="text-xs font-bold font-mono text-gray-800">{t.hex}</span>
                  </div>
                  {/* Source */}
                  <p className="text-[10px] text-gray-400 mb-2.5">
                    {t.source === "ai" ? (
                      <span className="text-purple-500 font-medium">AI detected</span>
                    ) : (
                      <span className="text-blue-500 font-medium">CSS parsing</span>
                    )}
                  </p>
                  {/* Action pills */}
                  <div className="flex gap-1.5">
                    {(["Primary", "Secondary", "Accent"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          if (role === "Primary") onSetPrimary(t.hex);
                          else if (role === "Secondary") onSetSecondary(t.hex);
                          else onSetAccent(t.hex);
                          setOpenIdx(null);
                        }}
                        className="flex-1 text-[10px] font-medium px-1.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Preview sidebar ────────────────────────────────────────────────────────────

function SidebarPreview({
  primary, secondary, appName, logo, sidebarStyle,
}: {
  primary: string; secondary: string; appName: string; logo: string | null; sidebarStyle: "dark" | "light";
}) {
  const isLight = sidebarStyle === "light";
  const bg       = isLight ? "white" : primary;
  const border   = isLight ? "#e5e7eb" : "rgba(0,0,0,0.15)";
  const divider  = isLight ? "#f3f4f6" : "rgba(255,255,255,0.12)";
  const logoBox  = isLight ? `color-mix(in srgb, ${primary} 12%, white)` : "rgba(255,255,255,0.15)";
  const nameCol  = isLight ? primary : "white";
  const activeNavBg = isLight ? `color-mix(in srgb, ${primary} 10%, white)` : "rgba(255,255,255,0.15)";
  const activeNavFg = isLight ? primary : "white";
  const inactiveFg  = isLight ? "#9ca3af" : "rgba(255,255,255,0.55)";
  const avatarBg    = secondary;

  return (
    <div className="rounded-xl overflow-hidden border shadow-sm" style={{ background: bg, borderColor: border }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: divider }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: logoBox }}>
          {logo ? (
            <img src={logo} alt="" className="w-5 h-5 object-contain" />
          ) : (
            <svg className="w-4 h-4" style={{ color: isLight ? primary : "white" }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5Zm-1 4v4.586l-2.293 2.293 1.414 1.414L13 14.414V9h-2Z" />
            </svg>
          )}
        </div>
        <span className="text-xs font-semibold truncate" style={{ color: nameCol }}>{appName || "SF Dashboard"}</span>
      </div>
      {/* Nav */}
      <div className="px-2 py-2 space-y-0.5">
        {["Dashboard", "Accounts", "Settings"].map((item, i) => (
          <div key={item} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md"
            style={{ background: i === 0 ? activeNavBg : "transparent", color: i === 0 ? activeNavFg : inactiveFg }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-current opacity-60" />
              <span className="text-xs">{item}</span>
            </div>
            {i === 1 && (
              <span className="text-[8px] px-1 rounded font-medium text-white" style={{ background: secondary, opacity: 0.9 }}>tag</span>
            )}
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="px-3 py-2.5 border-t flex items-center gap-2" style={{ borderColor: divider }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: avatarBg }}>U</div>
        <div className="flex-1 min-w-0">
          <div className="h-2 rounded mb-1" style={{ background: isLight ? "#e5e7eb" : "rgba(255,255,255,0.2)", width: "64px" }} />
          <div className="h-1.5 rounded w-10" style={{ background: secondary, opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsClient({ initial }: { initial: AppSettings }) {
  // Form state
  const [primary, setPrimary]         = useState(initial.primaryColor);
  const [secondary, setSecondary]     = useState(initial.secondaryColor);
  const [accent, setAccent]           = useState(initial.accentColor);
  const [appName, setAppName]         = useState(initial.appName);
  const [logo, setLogo]               = useState<string | null>(initial.logoBase64);
  const [headingFont, setHeadingFont] = useState(initial.headingFont);
  const [bodyFont, setBodyFont]       = useState(initial.bodyFont);
  const [headingFontUrl, setHeadingFontUrl] = useState<string | null>(initial.headingFontUrl);
  const [bodyFontUrl, setBodyFontUrl]       = useState<string | null>(initial.bodyFontUrl);
  const [borderRadius, setBorderRadius]     = useState(initial.borderRadius);
  const [sidebarStyle, setSidebarStyle]     = useState<"dark" | "light">(initial.sidebarStyle);

  // UI state
  const [saving, setSaving]       = useState(false);
  const [savedMsg, setSavedMsg]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Brand import state
  const [brandUrl, setBrandUrl]           = useState("");
  const [extracting, setExtracting]       = useState(false);
  const [extractPhase, setExtractPhase]   = useState<"css" | "ai" | null>(null);
  const [extractError, setExtractError]   = useState<string | null>(null);
  const [extracted, setExtracted]         = useState<BrandResult | null>(null);

  // Computed preview values (fall back to defaults for invalid hex)
  const prevPrimary   = isValidHex(primary)   ? primary   : DEFAULTS.primaryColor;
  const prevSecondary = isValidHex(secondary)  ? secondary : DEFAULTS.secondaryColor;
  const prevName      = appName.trim() || DEFAULTS.appName;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { setError("Logo must be 200 KB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function extractBrand() {
    const url = brandUrl.trim();
    if (!url) return;
    setExtracting(true);
    setExtractPhase("css");
    setExtractError(null);
    setExtracted(null);

    // Advance to AI phase after ~3s (CSS parsing is fast; AI takes ~5–10s)
    const phaseTimer = setTimeout(() => setExtractPhase("ai"), 3000);

    try {
      const res = await fetch("/api/settings/extract-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as BrandResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setExtracted(data);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      clearTimeout(phaseTimer);
      setExtracting(false);
      setExtractPhase(null);
    }
  }

  function applyAll() {
    if (!extracted) return;
    if (extracted.colors.primary)   setPrimary(extracted.colors.primary);
    if (extracted.colors.secondary) setSecondary(extracted.colors.secondary);
    if (extracted.colors.accent)    setAccent(extracted.colors.accent);
    if (extracted.companyName)      setAppName(extracted.companyName.slice(0, 30));
    if (extracted.logo)             setLogo(extracted.logo);
    if (extracted.fonts.heading)    setHeadingFont(extracted.fonts.heading);
    if (extracted.fonts.body)       setBodyFont(extracted.fonts.body);
    if (extracted.fonts.headingImportUrl) setHeadingFontUrl(extracted.fonts.headingImportUrl);
    if (extracted.fonts.bodyImportUrl)    setBodyFontUrl(extracted.fonts.bodyImportUrl);
  }

  async function save() {
    if (!isValidHex(primary))   { setError("Invalid primary color hex."); return; }
    if (!isValidHex(secondary)) { setError("Invalid secondary color hex."); return; }
    if (!isValidHex(accent))    { setError("Invalid accent color hex."); return; }
    if (appName.length > 30)    { setError("App name must be 30 characters or fewer."); return; }

    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          appName: appName.trim() || DEFAULTS.appName,
          logoBase64: logo,
          headingFont,
          bodyFont,
          headingFontUrl,
          bodyFontUrl,
          borderRadius,
          sidebarStyle,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      setSavedMsg("Settings saved. Reload the page to see changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULTS),
      });
      if (!res.ok) throw new Error("Reset failed");
      setPrimary(DEFAULTS.primaryColor);
      setSecondary(DEFAULTS.secondaryColor);
      setAccent(DEFAULTS.accentColor);
      setAppName(DEFAULTS.appName);
      setLogo(null);
      setHeadingFont(DEFAULTS.headingFont);
      setBodyFont(DEFAULTS.bodyFont);
      setHeadingFontUrl(null);
      setBodyFontUrl(null);
      setBorderRadius(DEFAULTS.borderRadius);
      setSidebarStyle(DEFAULTS.sidebarStyle);
      if (fileRef.current) fileRef.current.value = "";
      setSavedMsg("Reset to defaults. Reload the page to see changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-8 items-start">
      {/* ── Left: form ── */}
      <div className="flex-1 max-w-xl space-y-6">

        {/* Brand Import */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Import from Website</h2>
            <p className="text-xs text-gray-500 mt-0.5">Automatically extract colors, fonts, and logo from a company URL.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") extractBrand(); }}
              placeholder="https://company.com"
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={extracting}
            />
            <button
              onClick={extractBrand}
              disabled={extracting || !brandUrl.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {extracting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {extractPhase === "ai" ? "Analyzing with AI…" : "Scanning CSS…"}
                </span>
              ) : "Extract Brand"}
            </button>
          </div>

          {extractError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{extractError}</p>
          )}

          {/* Extraction results */}
          {extracted && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700">Extracted brand data</h3>
                <button
                  onClick={applyAll}
                  className="shrink-0 text-xs font-medium px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
                >
                  Apply All
                </button>
              </div>

              {/* Logo + name */}
              <div className="flex items-center gap-3">
                {extracted.logo ? (
                  <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={extracted.logo} alt="" className="w-7 h-7 object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg border border-dashed border-gray-300 flex items-center justify-center shrink-0">
                    <span className="text-[9px] text-gray-400 text-center leading-tight">No logo</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{extracted.companyName ?? "(no name detected)"}</p>
                  {extracted.logoUrl && <p className="text-[10px] text-gray-400 truncate">{extracted.logoUrl}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {extracted.logo && (
                    <button onClick={() => setLogo(extracted.logo)} className="text-[10px] px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-white transition-colors">Use logo</button>
                  )}
                  {extracted.companyName && (
                    <button onClick={() => setAppName(extracted.companyName!.slice(0, 30))} className="text-[10px] px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-white transition-colors">Use name</button>
                  )}
                </div>
              </div>

              {/* Colors */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                    Colors found ({extracted.colors.all.length})
                  </p>
                  {extracted.aiAnalyzed && (
                    <div className="flex items-center gap-2 text-[9px] text-gray-400">
                      <span className="inline-flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> CSS</span>
                      <span className="inline-flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" /> AI</span>
                    </div>
                  )}
                </div>
                {extracted.colors.all.length > 0 ? (
                  <>
                    {/* Extra bottom padding so popovers don't get clipped */}
                    <div className="pb-32">
                      <ColorSwatchRow
                        colors={extracted.colors.tagged ?? extracted.colors.all.map(h => ({ hex: h, source: "css" as const }))}
                        onSetPrimary={setPrimary}
                        onSetSecondary={setSecondary}
                        onSetAccent={setAccent}
                      />
                    </div>
                    <div className="flex gap-2 mt-1">
                      {extracted.colors.primary && (
                        <button onClick={() => setPrimary(extracted.colors.primary!)} className="text-[10px] px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-white transition-colors">Use suggested primary</button>
                      )}
                      {extracted.colors.secondary && (
                        <button onClick={() => setSecondary(extracted.colors.secondary!)} className="text-[10px] px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-white transition-colors">Use suggested secondary</button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    No brand colors detected. Please enter manually in the Colors section below.
                  </p>
                )}
              </div>

              {/* Fonts */}
              {(extracted.fonts.heading || extracted.fonts.body) && (
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Fonts detected</p>
                  <div className="flex flex-wrap gap-2">
                    {extracted.fonts.heading && (
                      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                        <span className="text-[10px] text-gray-400">Heading:</span>
                        <span className="text-[10px] font-medium text-gray-700">{extracted.fonts.heading}</span>
                        <button
                          onClick={() => { setHeadingFont(extracted.fonts.heading!); setHeadingFontUrl(extracted.fonts.headingImportUrl); }}
                          className="text-[10px] text-blue-500 hover:text-blue-700"
                        >
                          Use
                        </button>
                      </div>
                    )}
                    {extracted.fonts.body && extracted.fonts.body !== extracted.fonts.heading && (
                      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                        <span className="text-[10px] text-gray-400">Body:</span>
                        <span className="text-[10px] font-medium text-gray-700">{extracted.fonts.body}</span>
                        <button
                          onClick={() => { setBodyFont(extracted.fonts.body!); setBodyFontUrl(extracted.fonts.bodyImportUrl); }}
                          className="text-[10px] text-blue-500 hover:text-blue-700"
                        >
                          Use
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Branding section */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900">Branding</h2>

          {/* App name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">App Name</label>
            <input
              type="text"
              value={appName}
              maxLength={30}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="SF Dashboard"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">{appName.length}/30 characters</p>
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden">
                {logo ? (
                  <img src={logo} alt="Logo preview" className="w-8 h-8 object-contain" />
                ) : (
                  <svg className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5Zm-1 4v4.586l-2.293 2.293 1.414 1.414L13 14.414V9h-2Z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload image
                  <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg" className="sr-only" onChange={handleFileChange} />
                </label>
                {logo && (
                  <button onClick={() => { setLogo(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-xs text-red-500 hover:text-red-700 text-left">Remove logo</button>
                )}
                <p className="text-xs text-gray-400">PNG, JPG, or SVG · max 200 KB</p>
              </div>
            </div>
          </div>
        </section>

        {/* Colors section */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900">Colors</h2>
          <ColorInput label="Primary Color" value={primary} onChange={setPrimary} />
          <p className="text-xs text-gray-400 -mt-3">Sidebar background, buttons, active nav items.</p>
          <ColorInput label="Secondary Color" value={secondary} onChange={setSecondary} />
          <p className="text-xs text-gray-400 -mt-3">Badges, charts, pipeline bars, accents.</p>
          <ColorInput label="Accent Color" value={accent} onChange={setAccent} />
          <p className="text-xs text-gray-400 -mt-3">Highlights, alerts, call-to-action elements.</p>
        </section>

        {/* Typography */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900">Typography</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Heading Font</label>
            <input
              type="text"
              value={headingFont}
              onChange={(e) => setHeadingFont(e.target.value)}
              placeholder="Inter"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Font</label>
            <input
              type="text"
              value={bodyFont}
              onChange={(e) => setBodyFont(e.target.value)}
              placeholder="Inter"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(headingFontUrl || bodyFontUrl) && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 space-y-1">
              <p className="font-medium text-gray-500">Font import URLs (from brand extraction):</p>
              {headingFontUrl && <p className="truncate">{headingFontUrl}</p>}
              {bodyFontUrl && bodyFontUrl !== headingFontUrl && <p className="truncate">{bodyFontUrl}</p>}
              <button onClick={() => { setHeadingFontUrl(null); setBodyFontUrl(null); }} className="text-red-400 hover:text-red-600 mt-1">Clear font URLs</button>
            </div>
          )}
          <p className="text-xs text-gray-400">Enter any Google Fonts or system font name. Use "Import from Website" to auto-detect fonts.</p>
        </section>

        {/* Layout */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-sm font-semibold text-gray-900">Layout</h2>

          {/* Border radius */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Border Radius</label>
              <span className="text-sm font-mono text-gray-500">{borderRadius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={16}
              value={borderRadius}
              onChange={(e) => setBorderRadius(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Sharp (0px)</span>
              <span>Rounded (16px)</span>
            </div>
            <div className="flex gap-3 mt-3">
              {[0, 4, 8, 12, 16].map(r => (
                <button
                  key={r}
                  onClick={() => setBorderRadius(r)}
                  className={`w-10 h-8 border text-[10px] text-gray-500 transition-colors ${borderRadius === r ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                  style={{ borderRadius: `${r}px` }}
                >
                  {r}px
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sidebar Style</label>
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setSidebarStyle(style)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    sidebarStyle === style ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Mini preview */}
                  <div
                    className="w-12 h-10 rounded border overflow-hidden flex flex-col"
                    style={{ borderColor: style === "dark" ? "transparent" : "#e5e7eb", background: style === "dark" ? prevPrimary : "white" }}
                  >
                    <div className="flex-1 px-1.5 py-1 space-y-0.5">
                      <div className="h-1.5 rounded" style={{ background: style === "dark" ? "rgba(255,255,255,0.3)" : `color-mix(in srgb, ${prevPrimary} 15%, white)`, width: "70%" }} />
                      <div className="h-1.5 rounded" style={{ background: style === "dark" ? "rgba(255,255,255,0.12)" : "#f3f4f6", width: "55%" }} />
                      <div className="h-1.5 rounded" style={{ background: style === "dark" ? "rgba(255,255,255,0.12)" : "#f3f4f6", width: "60%" }} />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-700 capitalize">{style}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Actions */}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        {savedMsg && <p className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{savedMsg}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button
            onClick={reset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* ── Right: live preview ── */}
      <div className="w-56 shrink-0 sticky top-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</p>
        <SidebarPreview
          primary={prevPrimary}
          secondary={prevSecondary}
          appName={prevName}
          logo={logo}
          sidebarStyle={sidebarStyle}
        />
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-3 h-3 rounded shrink-0" style={{ background: prevPrimary }} />
            Primary — sidebar, buttons
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-3 h-3 rounded shrink-0" style={{ background: prevSecondary }} />
            Secondary — badges, charts
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-3 h-3 rounded shrink-0" style={{ background: isValidHex(accent) ? accent : DEFAULTS.accentColor }} />
            Accent — highlights, CTAs
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-2">
            <div className="w-3 h-1.5 rounded-sm shrink-0 bg-gray-300" style={{ borderRadius: `${borderRadius}px` }} />
            Border radius: {borderRadius}px
          </div>
        </div>
      </div>
    </div>
  );
}
