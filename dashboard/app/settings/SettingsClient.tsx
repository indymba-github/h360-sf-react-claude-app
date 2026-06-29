"use client";

import { useState, useEffect, useRef, useCallback, type DragEvent } from "react";
import Image from "next/image";
import SectionHeader from "@/components/SectionHeader";
import BrandFromWebsiteSection from "@/components/settings/BrandFromWebsiteSection";
import ConnectionDiagnosticsSection from "@/components/settings/ConnectionDiagnosticsSection";
import PresetEditPanel from "@/components/settings/PresetEditPanel";
import PresetLibraryPanel from "@/components/settings/PresetLibraryPanel";
import { getPresets, savePresets, restoreSeeded, newPresetId, type DemoPack } from "@/lib/demoPacks";
import { BODY_FONT_OPTIONS, DISPLAY_FONT_OPTIONS } from "@/lib/branding-options";
import { buildBlankPreset, duplicatePreset } from "@/lib/preset-library";
import {
  buildBrandSettingsPatch,
  buildPresetSettingsPatch,
  upsertBrandPreset,
  type ExtractedBrandResult,
} from "@/lib/brand-settings";
import {
  applyBrandingSettings,
  applyStoredBrandingSettings,
  loadGoogleFont,
  notifyBrandingChanged,
  persistBrandingSettings,
  postBrandingSettings,
  readStoredSettings as readSettings,
  writeStoredSettings as writeSettings,
} from "@/lib/branding-client";
import { getProvidersConfig, setDefaultProvider, PROVIDER_LABELS, type Provider } from "@/lib/providers";
import { getAgentProfiles, saveAgentProfiles, getActiveAgentProfile, setActiveAgentProfile, isValidAgentId, type AgentProfile } from "@/lib/agents";
import ModelPicker from "@/components/ModelPicker";
import { SF_MODELS_DEFAULT_API_NAME } from "@/lib/salesforce-models-catalog";

// ── localStorage helpers ───────────────────────────────────────────────────

const LS_PROMPTS = "prompts.library";

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_ACCENT    = "#946F1F";
const DEFAULT_PAPER     = "#F4F1EA";
const DEFAULT_TEXT      = "#1B1F2A";
const DEFAULT_HEADER_BG = "#1B1F2A";
const DEFAULT_HEADER_FG = "#F4F1EA";
const DEFAULT_INK       = "#1B1F2A";  // legacy alias
const DEFAULT_APP_NAME     = "Cumulus Bank";
const DEFAULT_DISPLAY_FONT = "Source Serif 4";
const DEFAULT_BODY_FONT    = "Inter";

// ── Prompt library types ───────────────────────────────────────────────────

type PromptTab = "account" | "dashboard" | "accounts" | "settings";

interface LibraryPrompt {
  id: string;
  tab: PromptTab;
  text: string;
  visible: boolean;
}

const DEFAULT_PROMPTS: LibraryPrompt[] = [
  { id: "d1", tab: "dashboard", text: "Summarize my open pipeline by stage.", visible: true },
  { id: "d2", tab: "dashboard", text: "Which of my open deals are most at risk?", visible: true },
  { id: "d3", tab: "dashboard", text: "What deals have I closed in the last 30 days?", visible: true },
  { id: "a1", tab: "accounts",  text: "Find accounts in financial services with revenue over $10M.", visible: true },
  { id: "a2", tab: "accounts",  text: "Which accounts have been modified most recently?", visible: true },
  { id: "ac1", tab: "account",  text: "Give me a briefing on this account.", visible: true },
  { id: "ac2", tab: "account",  text: "What are the open opportunities for this account?", visible: true },
  { id: "ac3", tab: "account",  text: "Who are the key contacts here?", visible: true },
  { id: "s1",  tab: "settings", text: "How do I connect the hosted MCP server?", visible: true },
];

function readPrompts(): LibraryPrompt[] {
  try {
    const raw = localStorage.getItem(LS_PROMPTS);
    return raw ? (JSON.parse(raw) as LibraryPrompt[]) : DEFAULT_PROMPTS;
  } catch {
    return DEFAULT_PROMPTS;
  }
}

function writePrompts(prompts: LibraryPrompt[]) {
  localStorage.setItem(LS_PROMPTS, JSON.stringify(prompts));
}

// ── Shared field components ────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-soft)", marginBottom: "6px" }}>
      {children}
    </p>
  );
}

function TextInput({ value, onChange, placeholder, maxLength, readOnly, monospace }: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  readOnly?: boolean;
  monospace?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      readOnly={readOnly}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full px-3 py-2 text-sm outline-none"
      style={{
        background: readOnly ? "color-mix(in srgb, var(--color-border) 30%, var(--color-surface))" : "var(--color-paper)",
        border: "0.5px solid var(--color-border)",
        color: readOnly ? "var(--color-ink-muted)" : "var(--color-ink)",
        fontFamily: monospace ? "var(--font-mono)" : "var(--font-body)",
        fontSize: "12px",
        cursor: readOnly ? "default" : undefined,
      }}
      onFocus={(e) => { if (!readOnly) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent-soft)"; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
    />
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 space-y-5" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
      {children}
    </div>
  );
}

function HelpText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

// ── Color swatch ───────────────────────────────────────────────────────────

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => inputRef.current?.click()}
        className="shrink-0 relative"
        style={{ width: 36, height: 28, background: value, border: "0.5px solid var(--color-border)" }}
        title={`Pick ${label} color`}
      >
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </button>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-soft)", marginBottom: "2px" }}>
          {label}
        </p>
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="outline-none"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-ink)",
            background: "transparent",
            border: "none",
            width: "72px",
          }}
        />
      </div>
    </div>
  );
}

// ── Brand extraction preview ───────────────────────────────────────────────

type BrandResult = ExtractedBrandResult;

// ── Font loader ────────────────────────────────────────────────────────────

// ── 00 Profile section ─────────────────────────────────────────────────────

function ProfileSection({ displayName }: { displayName: string | null }) {
  return (
    <SectionCard>
      <div>
        <FieldLabel>Full name</FieldLabel>
        <TextInput value={displayName ?? ""} readOnly />
      </div>
    </SectionCard>
  );
}

// ── 03 Palette section ─────────────────────────────────────────────────────

function PaletteSection() {
  const [accent,   setAccentState]   = useState(DEFAULT_ACCENT);
  const [paper,    setPaperState]    = useState(DEFAULT_PAPER);
  const [text,     setTextState]     = useState(DEFAULT_TEXT);
  const [headerBg, setHeaderBgState] = useState(DEFAULT_HEADER_BG);
  const [headerFg, setHeaderFgState] = useState(DEFAULT_HEADER_FG);

  useEffect(() => {
    const s = readSettings();
    if (s.accentColor)   setAccentState(s.accentColor);
    if (s.paperColor)    setPaperState(s.paperColor);
    if (s.textColor)     setTextState(s.textColor);
    else if (s.inkColor) setTextState(s.inkColor);  // migrate legacy
    if (s.headerBgColor) setHeaderBgState(s.headerBgColor);
    else if (s.inkColor) setHeaderBgState(s.inkColor);  // migrate legacy
    if (s.headerFgColor) setHeaderFgState(s.headerFgColor);
  }, []);

  function isValidHex(value: string) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function updatePalette(patch: Parameters<typeof persistBrandingSettings>[0], applyLive: boolean) {
    void persistBrandingSettings(patch, {
      applyLive,
      persistServer: false,
      brandingEvent: "none",
    });
  }

  function setAccent(v: string) {
    setAccentState(v);
    updatePalette({ accentColor: v }, isValidHex(v));
  }

  function setPaper(v: string) {
    setPaperState(v);
    updatePalette({ paperColor: v }, isValidHex(v));
  }

  function setText(v: string) {
    setTextState(v);
    updatePalette({ textColor: v }, isValidHex(v));
  }

  function setHeaderBg(v: string) {
    setHeaderBgState(v);
    updatePalette({ headerBgColor: v }, isValidHex(v));
  }

  function setHeaderFg(v: string) {
    setHeaderFgState(v);
    updatePalette({ headerFgColor: v }, isValidHex(v));
  }

  function reset() {
    setAccentState(DEFAULT_ACCENT);
    setPaperState(DEFAULT_PAPER);
    setTextState(DEFAULT_TEXT);
    setHeaderBgState(DEFAULT_HEADER_BG);
    setHeaderFgState(DEFAULT_HEADER_FG);
    updatePalette({
      accentColor: DEFAULT_ACCENT, paperColor: DEFAULT_PAPER,
      textColor: DEFAULT_TEXT, headerBgColor: DEFAULT_HEADER_BG,
      headerFgColor: DEFAULT_HEADER_FG,
      inkColor: DEFAULT_INK,
    }, true);
  }

  return (
    <SectionCard>
      <div className="flex flex-wrap gap-6">
        <ColorSwatch label="Accent"      value={accent}   onChange={setAccent}   />
        <ColorSwatch label="Paper"       value={paper}    onChange={setPaper}    />
        <ColorSwatch label="Text"        value={text}     onChange={setText}     />
        <ColorSwatch label="Header"      value={headerBg} onChange={setHeaderBg} />
        <ColorSwatch label="Header Text" value={headerFg} onChange={setHeaderFg} />
      </div>
      <div className="flex justify-end">
        <button
          onClick={reset}
          style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", textDecoration: "underline" }}
          className="transition-opacity hover:opacity-60"
        >
          Reset to defaults
        </button>
      </div>
    </SectionCard>
  );
}

// ── 04 Theme section ──────────────────────────────────────────────────────

type ThemePreference = "light" | "dark" | "system";

function ThemeSection() {
  const [theme, setThemeState] = useState<ThemePreference>("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as ThemePreference | null;
    if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
  }, []);

  function setTheme(v: ThemePreference) {
    setThemeState(v);
    localStorage.setItem("theme", v);
    const isDark =
      v === "dark" ||
      (v === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

    applyBrandingSettings(readSettings());
    notifyBrandingChanged({ brandingEvent: "none", themeChanged: true });
  }

  const options: { value: ThemePreference; label: string }[] = [
    { value: "light",  label: "Light" },
    { value: "dark",   label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <SectionCard>
      <div>
        <FieldLabel>Appearance</FieldLabel>
        <div className="flex gap-0 mt-1" style={{ display: "inline-flex" }}>
          {options.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                style={{
                  padding: "5px 16px",
                  fontSize: "12px",
                  fontFamily: "var(--font-body)",
                  fontWeight: active ? 500 : 400,
                  background: active ? "var(--color-paper)" : "var(--color-surface)",
                  color: active ? "var(--color-ink)" : "var(--color-ink-soft)",
                  border: active
                    ? "0.5px solid var(--color-accent)"
                    : "0.5px solid var(--color-border)",
                  cursor: "pointer",
                  transition: "all 100ms ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <HelpText>System follows your operating system&rsquo;s appearance preference.</HelpText>
    </SectionCard>
  );
}

// ── 05 Typography section ─────────────────────────────────────────────────

function TypographySection() {
  const [display, setDisplayState] = useState("Source Serif 4");
  const [body,    setBodyState]    = useState("Inter");
  const [preview, setPreviewText]  = useState<{ display: string; body: string }>({ display: "Source Serif 4", body: "Inter" });

  useEffect(() => {
    const s = readSettings();
    if (s.displayFont) { setDisplayState(s.displayFont); loadGoogleFont(s.displayFont); }
    if (s.bodyFont)    { setBodyState(s.bodyFont);    loadGoogleFont(s.bodyFont); }
    setPreviewText({ display: s.displayFont ?? "Source Serif 4", body: s.bodyFont ?? "Inter" });
  }, []);

  function setDisplay(v: string) {
    setDisplayState(v);
    void persistBrandingSettings({ displayFont: v }, { persistServer: false, brandingEvent: "none" });
    setPreviewText((prev) => ({ ...prev, display: v }));
  }

  function setBody(v: string) {
    setBodyState(v);
    void persistBrandingSettings({ bodyFont: v }, { persistServer: false, brandingEvent: "none" });
    setPreviewText((prev) => ({ ...prev, body: v }));
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--color-paper)",
    border: "0.5px solid var(--color-border)",
    color: "var(--color-ink)",
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    padding: "6px 10px",
    outline: "none",
    width: "100%",
  };

  return (
    <SectionCard>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Display (headlines)</FieldLabel>
          <select value={display} onChange={(e) => setDisplay(e.target.value)} style={selectStyle}>
            {DISPLAY_FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Body (UI text)</FieldLabel>
          <select value={body} onChange={(e) => setBody(e.target.value)} style={selectStyle}>
            {BODY_FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Live preview */}
      <div className="p-4" style={{ background: "var(--color-paper)", border: "0.5px solid var(--color-border)" }}>
        <p style={{ fontFamily: `'${preview.display}', serif`, fontSize: "18px", fontWeight: 500, color: "var(--color-ink)", marginBottom: "4px" }}>
          Good morning, <em style={{ color: "var(--color-accent-text)", fontStyle: "italic" }}>you.</em>
        </p>
        <p style={{ fontFamily: `'${preview.body}', sans-serif`, fontSize: "12px", color: "var(--color-ink-muted)" }}>
          Your pipeline is on track. 4 accounts updated this week.
        </p>
      </div>
    </SectionCard>
  );
}

// ── 05 Prompts library section ─────────────────────────────────────────────

const TAB_LABELS: Record<PromptTab, string> = {
  account:   "Account detail",
  dashboard: "Dashboard",
  accounts:  "Accounts list",
  settings:  "Settings",
};

function PromptsLibrarySection() {
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [activeTab, setActiveTab] = useState<PromptTab>("account");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);

  useEffect(() => {
    setPrompts(readPrompts());
  }, []);

  function save(updated: LibraryPrompt[]) {
    setPrompts(updated);
    writePrompts(updated);
  }

  function addPrompt() {
    const id = `custom-${Date.now()}`;
    const updated = [...prompts, { id, tab: activeTab, text: "", visible: true }];
    save(updated);
    setEditingId(id);
  }

  function updateText(id: string, text: string) {
    save(prompts.map((p) => p.id === id ? { ...p, text } : p));
  }

  function toggleVisible(id: string) {
    save(prompts.map((p) => p.id === id ? { ...p, visible: !p.visible } : p));
  }

  function deletePrompt(id: string) {
    save(prompts.filter((p) => p.id !== id));
  }

  const handleDragStart = useCallback((id: string) => {
    dragItem.current = id;
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    const from = dragItem.current;
    if (!from || from === targetId) { setDragOver(null); return; }
    const tabPrompts = prompts.filter((p) => p.tab === activeTab);
    const others     = prompts.filter((p) => p.tab !== activeTab);
    const fromIdx = tabPrompts.findIndex((p) => p.id === from);
    const toIdx   = tabPrompts.findIndex((p) => p.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragOver(null); return; }
    const reordered = [...tabPrompts];
    reordered.splice(toIdx, 0, reordered.splice(fromIdx, 1)[0]);
    save([...others, ...reordered]);
    dragItem.current = null;
    setDragOver(null);
  }, [prompts, activeTab]);

  const tabPrompts = prompts.filter((p) => p.tab === activeTab);

  return (
    <SectionCard>
      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border)", paddingBottom: "0" }}>
        {(Object.keys(TAB_LABELS) as PromptTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "5px 10px",
              color: activeTab === tab ? "var(--color-ink)" : "var(--color-ink-soft)",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "1.5px solid var(--color-accent)" : "1.5px solid transparent",
              marginBottom: "-0.5px",
              cursor: "pointer",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Prompt list */}
      <div className="space-y-1.5 min-h-[80px]">
        {tabPrompts.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", padding: "12px 0" }}>
            No prompts yet. Add one below.
          </p>
        )}
        {tabPrompts.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => handleDragStart(p.id)}
            onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(p.id); }}
            onDrop={() => handleDrop(p.id)}
            onDragEnd={() => { dragItem.current = null; setDragOver(null); }}
            className="group flex items-center gap-2"
            style={{
              opacity: p.visible ? 1 : 0.45,
              background: dragOver === p.id ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))" : "transparent",
              transition: "background 80ms",
            }}
          >
            {/* Drag handle */}
            <svg
              className="w-3 h-3 shrink-0 cursor-grab"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              style={{ color: "var(--color-ink-soft)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>

            {/* Text */}
            {editingId === p.id ? (
              <input
                autoFocus
                type="text"
                value={p.text}
                onChange={(e) => updateText(p.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingId(null); }}
                className="flex-1 px-2 py-1 text-xs outline-none"
                style={{
                  background: "var(--color-paper)",
                  border: "0.5px solid var(--color-accent-soft)",
                  color: "var(--color-ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                }}
              />
            ) : (
              <button
                onClick={() => setEditingId(p.id)}
                className="flex-1 text-left py-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-ink)",
                  background: "transparent",
                  border: "none",
                }}
              >
                {p.text || <span style={{ color: "var(--color-ink-soft)", fontStyle: "italic" }}>Empty prompt — click to edit</span>}
              </button>
            )}

            {/* Visibility toggle */}
            <button
              onClick={() => toggleVisible(p.id)}
              title={p.visible ? "Hide" : "Show"}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: p.visible ? "var(--color-ink-soft)" : "var(--color-ink-soft)", opacity: p.visible ? 1 : 0.4 }}
            >
              {p.visible ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              )}
            </button>

            {/* Delete */}
            <button
              onClick={() => deletePrompt(p.id)}
              title="Delete"
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--color-danger)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={addPrompt}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            color: "var(--color-accent-text)",
            background: "transparent",
            border: "none",
          }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add prompt
        </button>
      </div>
    </SectionCard>
  );
}

// ── 06 Branding section ────────────────────────────────────────────────────

function BrandingSection() {
  const [appName, setAppNameState] = useState(DEFAULT_APP_NAME);
  const [logo, setLogoState]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const syncFromSettings = () => {
      const s = readSettings();
      setAppNameState(s.appName ?? DEFAULT_APP_NAME);
      setLogoState(s.logoBase64 ?? null);
      setSaveMsg(null);
    };

    const handleReset = () => {
      setAppNameState(DEFAULT_APP_NAME);
      setLogoState(null);
      setSaveMsg(null);
      if (fileRef.current) fileRef.current.value = "";
    };

    syncFromSettings();
    window.addEventListener("branding-changed", syncFromSettings);
    window.addEventListener("branding-reset", handleReset);
    return () => {
      window.removeEventListener("branding-changed", syncFromSettings);
      window.removeEventListener("branding-reset", handleReset);
    };
  }, []);

  function handleNameChange(v: string) {
    setAppNameState(v);
    setSaveMsg(null);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { setSaveMsg("Logo must be 200 KB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogoState(b64);
      void persistBrandingSettings({ logoBase64: b64 }, { themeChanged: false })
        .then(({ serverSaved }) => setSaveMsg(serverSaved ? null : "Saved locally. Server sync failed."));
    };
    reader.readAsDataURL(file);
  }

  async function saveName() {
    const trimmed = appName.trim() || DEFAULT_APP_NAME;
    setAppNameState(trimmed);
    const { serverSaved } = await persistBrandingSettings({ appName: trimmed }, { themeChanged: false });
    setSaveMsg(serverSaved ? "Saved." : "Saved locally. Server sync failed.");
  }

  function removeLogo() {
    setLogoState(null);
    if (fileRef.current) fileRef.current.value = "";
    void persistBrandingSettings({ logoBase64: null }, { themeChanged: false })
      .then(({ serverSaved }) => {
        if (!serverSaved) setSaveMsg("Removed locally. Server sync failed.");
      });
  }

  return (
    <SectionCard>
      <div>
        <FieldLabel>App name</FieldLabel>
        <div className="flex gap-2">
          <TextInput value={appName} onChange={handleNameChange} placeholder="SF Dashboard" maxLength={30} />
          <button
            onClick={saveName}
            className="shrink-0 px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--color-ink)", color: "var(--color-paper)", fontFamily: "var(--font-body)", fontSize: "11px", whiteSpace: "nowrap" }}
          >
            Save
          </button>
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)", marginTop: "4px" }}>
          {appName.length}/30 characters
        </p>
      </div>

      <div>
        <FieldLabel>Logo</FieldLabel>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 44, height: 44, background: "var(--color-paper)", border: "0.5px solid var(--color-border)" }}
          >
            {logo ? (
              <Image src={logo} alt="Logo" width={28} height={28} unoptimized style={{ objectFit: "contain" }} />
            ) : (
              <svg className="w-5 h-5" style={{ color: "var(--color-ink-soft)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="cursor-pointer inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "var(--color-ink-muted)",
                background: "var(--color-paper)",
                border: "0.5px solid var(--color-border)",
                padding: "4px 10px",
              }}
            >
              Upload image
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg" className="sr-only" onChange={handleFilePick} />
            </label>
            {logo && (
              <button
                onClick={removeLogo}
                style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)", textAlign: "left" }}
                className="transition-opacity hover:opacity-70"
              >
                Remove logo
              </button>
            )}
            <HelpText>PNG, JPG, or SVG · max 200 KB</HelpText>
          </div>
        </div>
      </div>

      {saveMsg && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-success)" }}>{saveMsg}</p>
      )}
    </SectionCard>
  );
}

// ── Agent manager (inline, used inside AiProviderSection) ─────────────────

function AgentManager() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add/edit form state
  const [formLabel, setFormLabel] = useState("");
  const [formAgentId, setFormAgentId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getAgentProfiles().then((p) => {
      setProfiles(p);
      const active = getActiveAgentProfile(p);
      setActiveIdState(active?.id ?? null);
    });

    const sync = () => {
      getAgentProfiles().then((p) => {
        setProfiles(p);
        const active = getActiveAgentProfile(p);
        setActiveIdState(active?.id ?? null);
      });
    };
    window.addEventListener("agentforce-profiles-changed", sync);
    window.addEventListener("agentforce-active-changed", sync);
    return () => {
      window.removeEventListener("agentforce-profiles-changed", sync);
      window.removeEventListener("agentforce-active-changed", sync);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(updated: AgentProfile[]) {
    setProfiles(updated);
    saveAgentProfiles(updated);
  }

  function handleSetActive(id: string) {
    setActiveIdState(id);
    setActiveAgentProfile(id);
  }

  function openEdit(profile: AgentProfile) {
    setEditingId(profile.id);
    setFormLabel(profile.label);
    setFormAgentId(profile.agentId);
    setFormDescription(profile.description ?? "");
    setFormError(null);
    setShowAddForm(false);
  }

  function openAdd() {
    setShowAddForm(true);
    setEditingId(null);
    setFormLabel("");
    setFormAgentId("");
    setFormDescription("");
    setFormError(null);
  }

  function validate(label: string, agentId: string, selfId?: string): string | null {
    if (!label.trim()) return "Label is required.";
    const duplicate = profiles.find(
      (p) => p.label.trim().toLowerCase() === label.trim().toLowerCase() && p.id !== selfId
    );
    if (duplicate) return "A profile with this label already exists.";
    if (!isValidAgentId(agentId)) return "Agent ID must be exactly 15 or 18 alphanumeric characters.";
    return null;
  }

  function handleSaveEdit() {
    const err = validate(formLabel, formAgentId, editingId ?? undefined);
    if (err) { setFormError(err); return; }
    const updated = profiles.map((p) => {
      if (p.id !== editingId) return p;
      const wasDefaultDescription = p.description === "Loaded from SF_AGENT_ID";
      return {
        ...p,
        label: formLabel.trim(),
        agentId: formAgentId.trim(),
        description: formDescription.trim() || (wasDefaultDescription && p.agentId !== formAgentId.trim() ? "(Customized)" : (formDescription.trim() || p.description)),
      };
    });
    persist(updated);
    setEditingId(null);
  }

  function handleSaveAdd() {
    const err = validate(formLabel, formAgentId);
    if (err) { setFormError(err); return; }
    const slug = formLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const newProfile: AgentProfile = {
      id: `custom-${slug}-${Date.now()}`,
      label: formLabel.trim(),
      agentId: formAgentId.trim(),
      description: formDescription.trim() || undefined,
      isDefault: false,
    };
    persist([...profiles, newProfile]);
    setShowAddForm(false);
  }

  function handleDelete(id: string) {
    const updated = profiles.filter((p) => p.id !== id);
    if (activeId === id) {
      const next = updated[0] ?? null;
      if (next) {
        setActiveIdState(next.id);
        setActiveAgentProfile(next.id);
      } else {
        setActiveIdState(null);
      }
    }
    persist(updated);
    setDeletingId(null);
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "5px 8px", fontSize: "12px",
    fontFamily: "var(--font-body)", background: "var(--color-paper)",
    border: "0.5px solid var(--color-border)", color: "var(--color-ink)", outline: "none",
  };

  return (
    <div style={{ marginTop: 10 }}>
      {/* Profile list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {profiles.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", padding: "10px 0" }}>
            No agents configured. Add one below to start using Agentforce.
          </p>
        )}
        {profiles.map((profile) => {
          const isActive = profile.id === activeId;
          const isEditing = editingId === profile.id;
          const isDeleting = deletingId === profile.id;

          return (
            <div key={profile.id} style={{ border: "0.5px solid var(--color-border)", background: "var(--color-paper)" }}>
              {isEditing ? (
                <div style={{ padding: "10px 12px" }}>
                  {profile.isDefault && (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", marginBottom: 8, fontStyle: "italic" }}>
                      Editing the Default profile overrides SF_AGENT_ID for this session. Delete this profile to revert to env.
                    </p>
                  )}
                  <div style={{ display: "grid", gap: 8 }}>
                    <div>
                      <FieldLabel>Label</FieldLabel>
                      <input style={inputSt} value={formLabel} onChange={(e) => { setFormLabel(e.target.value); setFormError(null); }} />
                    </div>
                    <div>
                      <FieldLabel>Agent ID</FieldLabel>
                      <input style={{ ...inputSt, fontFamily: "var(--font-mono)" }} value={formAgentId} onChange={(e) => { setFormAgentId(e.target.value); setFormError(null); }} placeholder="15 or 18 alphanumeric characters" />
                    </div>
                    <div>
                      <FieldLabel>Description (optional)</FieldLabel>
                      <input style={inputSt} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                    </div>
                    {formError && <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)" }}>{formError}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleSaveEdit} style={{ padding: "4px 12px", fontFamily: "var(--font-body)", fontSize: "11px", background: "var(--color-accent)", color: "var(--color-accent-foreground)", border: "none", cursor: "pointer" }}>Save</button>
                      <button onClick={() => { setEditingId(null); setFormError(null); }} style={{ padding: "4px 12px", fontFamily: "var(--font-body)", fontSize: "11px", background: "transparent", color: "var(--color-ink-soft)", border: "0.5px solid var(--color-border)", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : isDeleting ? (
                <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-ink)", flex: 1 }}>
                    Delete &ldquo;{profile.label}&rdquo;?
                  </p>
                  <button onClick={() => handleDelete(profile.id)} style={{ padding: "4px 10px", fontFamily: "var(--font-body)", fontSize: "11px", background: "var(--color-danger)", color: "#fff", border: "none", cursor: "pointer" }}>Delete</button>
                  <button onClick={() => setDeletingId(null)} style={{ padding: "4px 10px", fontFamily: "var(--font-body)", fontSize: "11px", background: "transparent", color: "var(--color-ink-soft)", border: "0.5px solid var(--color-border)", cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <div style={{ padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {/* Active indicator */}
                  <button
                    onClick={() => handleSetActive(profile.id)}
                    title={isActive ? "Active" : "Set as active"}
                    style={{ flexShrink: 0, marginTop: 3, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <span style={{
                      display: "block", width: 8, height: 8, borderRadius: "50%",
                      background: isActive ? "var(--color-accent)" : "transparent",
                      border: isActive ? "none" : "1px solid var(--color-border)",
                    }} />
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>{profile.label}</span>
                      {profile.isDefault && (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--color-ink-soft)", letterSpacing: "0.08em", textTransform: "uppercase" }}>(Default)</span>
                      )}
                    </div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-ink-muted)", marginBottom: profile.description ? 2 : 0 }}>{profile.agentId}</p>
                    {profile.description && (
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>{profile.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(profile)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-soft)", padding: 2 }} className="transition-opacity hover:opacity-60">
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    {!profile.isDefault && (
                      <button onClick={() => setDeletingId(profile.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)", padding: 2 }} className="transition-opacity hover:opacity-60">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ marginTop: 8, padding: "10px 12px", border: "0.5px solid var(--color-border)", background: "var(--color-paper)" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <FieldLabel>Label</FieldLabel>
              <input style={inputSt} value={formLabel} onChange={(e) => { setFormLabel(e.target.value); setFormError(null); }} placeholder="e.g. Sales Demo" />
            </div>
            <div>
              <FieldLabel>Agent ID</FieldLabel>
              <input style={{ ...inputSt, fontFamily: "var(--font-mono)" }} value={formAgentId} onChange={(e) => { setFormAgentId(e.target.value); setFormError(null); }} placeholder="0XxHn000000…" />
            </div>
            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <input style={inputSt} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What is this agent for?" />
            </div>
            {formError && <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)" }}>{formError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveAdd} style={{ padding: "4px 12px", fontFamily: "var(--font-body)", fontSize: "11px", background: "var(--color-accent)", color: "var(--color-accent-foreground)", border: "none", cursor: "pointer" }}>Save</button>
              <button onClick={() => { setShowAddForm(false); setFormError(null); }} style={{ padding: "4px 12px", fontFamily: "var(--font-body)", fontSize: "11px", background: "transparent", color: "var(--color-ink-soft)", border: "0.5px solid var(--color-border)", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showAddForm && (
        <button
          onClick={openAdd}
          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-accent-text)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          className="transition-opacity hover:opacity-70"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add agent
        </button>
      )}
    </div>
  );
}

// ── 09 Trust Layer Model section ──────────────────────────────────────────

function TrustLayerModelSection() {
  const [model, setModelState] = useState<string>(SF_MODELS_DEFAULT_API_NAME);

  useEffect(() => {
    const s = readSettings();
    if (s.trustLayerModel) setModelState(s.trustLayerModel);
  }, []);

  function handleChange(apiName: string) {
    setModelState(apiName);
    writeSettings({ trustLayerModel: apiName });
    // Persist to server so the chat route can read it server-side
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustLayerModel: apiName }),
    });
  }

  return (
    <SectionCard>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--color-ink-soft)", lineHeight: 1.55, marginBottom: 4 }}>
        Selects which LLM the AI assistant uses when Trust Layer mode is on. All listed
        models route through Salesforce&rsquo;s Einstein Trust Layer for PII masking, content
        filtering, and audit logging. Models marked &ldquo;Inside Trust Boundary&rdquo; run on
        infrastructure within Salesforce&rsquo;s perimeter; others are hosted by Salesforce partners.
      </p>
      <ModelPicker value={model} onChange={handleChange} />
    </SectionCard>
  );
}

// ── 10 AI provider section ─────────────────────────────────────────────────

function AiProviderSection() {
  const ALL_PROVIDERS: Provider[] = ["local", "hosted", "agentforce"];
  const [config, setConfig] = useState<import("@/lib/providers").ProvidersConfig | null>(null);
  const [defaultProvider, setDefaultProviderState] = useState<Provider | null>(null);
  const [manageAgents, setManageAgents] = useState(false);
  const [agentProfileCount, setAgentProfileCount] = useState<number | null>(null);

  useEffect(() => {
    getProvidersConfig().then((cfg) => {
      setConfig(cfg);
      const available = (Object.keys(cfg) as Provider[]).filter((p) => cfg[p].configured);
      const stored = localStorage.getItem("ai-panel.default-provider") as Provider | null;
      setDefaultProviderState(stored && available.includes(stored) ? stored : (available[0] ?? null));
    });

    // Check profile count so we can auto-expand the editor when there are none
    getAgentProfiles().then((profiles) => {
      setAgentProfileCount(profiles.length);
      // Auto-expand if the URL targets #agentforce and editor is not already open
      if (typeof window !== "undefined" && window.location.hash === "#agentforce" && profiles.length === 0) {
        setManageAgents(true);
      }
    });

    const syncProfiles = () => {
      getAgentProfiles().then((profiles) => setAgentProfileCount(profiles.length));
    };
    window.addEventListener("agentforce-profiles-changed", syncProfiles);
    return () => window.removeEventListener("agentforce-profiles-changed", syncProfiles);
  }, []);

  function handleSetDefault(p: Provider) {
    setDefaultProviderState(p);
    setDefaultProvider(p);
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--color-paper)",
    border: "0.5px solid var(--color-border)",
    color: "var(--color-ink)",
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    padding: "6px 10px",
    outline: "none",
    width: "220px",
  };

  if (!config) {
    return (
      <SectionCard>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
          Loading provider configuration…
        </p>
      </SectionCard>
    );
  }

  const configured = ALL_PROVIDERS.filter((p) => config[p].configured);

  return (
    <SectionCard>
      <HelpText>
        Configure which AI providers power the AI Assistant panel. Providers without configured credentials are hidden from the panel.
      </HelpText>

      {/* Provider rows */}
      <div style={{ border: "0.5px solid var(--color-border)" }}>
        {ALL_PROVIDERS.map((p, i) => {
          const status = config[p];
          const isConfigured = status.configured;
          const isAgentforce = p === "agentforce";
          return (
            <div key={p} id={isAgentforce ? "agentforce" : undefined}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  borderBottom: (!isAgentforce || !isConfigured) && i < ALL_PROVIDERS.length - 1 ? "0.5px solid var(--color-border)" : "none",
                  background: "var(--color-paper)",
                }}
              >
                <span
                  style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: isConfigured ? "var(--color-accent)" : "var(--color-ink-soft)",
                    opacity: isConfigured ? 1 : 0.45,
                    flexShrink: 0, marginTop: 4,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
                      {PROVIDER_LABELS[p]}
                    </span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: isConfigured ? "var(--color-ink-muted)" : "var(--color-ink-soft)" }}>
                      {isConfigured ? "Configured" : "Not configured"}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
                    {isConfigured ? status.description : status.hint}
                  </p>

                  {/* Manage agents link — active picker moved to AI panel */}
                  {isAgentforce && isConfigured && !manageAgents && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        onClick={() => setManageAgents(true)}
                        style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-accent-text)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                      >
                        {agentProfileCount === 0 ? "Add your first agent" : "Manage agents"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent manager expansion */}
              {isAgentforce && isConfigured && manageAgents && (
                <div style={{
                  borderTop: "0.5px solid var(--color-border)",
                  borderBottom: i < ALL_PROVIDERS.length - 1 ? "0.5px solid var(--color-border)" : "none",
                  padding: "12px 14px",
                  background: "color-mix(in srgb, var(--color-accent) 3%, var(--color-surface))",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 500, color: "var(--color-ink)" }}>Manage agents</span>
                    <button
                      onClick={() => setManageAgents(false)}
                      style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Done
                    </button>
                  </div>
                  <AgentManager />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Default dropdown */}
      {configured.length === 0 ? (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
          No AI providers configured. Enable at least one to use the AI Assistant.
        </p>
      ) : (
        <div>
          <FieldLabel>Default provider</FieldLabel>
          <select
            value={defaultProvider ?? ""}
            onChange={(e) => handleSetDefault(e.target.value as Provider)}
            style={selectStyle}
          >
            {configured.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]} — {config[p].description}</option>
            ))}
          </select>
        </div>
      )}
    </SectionCard>
  );
}

// ── 00 Presets section ─────────────────────────────────────────────────────

type PresetView = "grid" | "edit";

function PresetsSection({ onActivate }: { onActivate: (preset: DemoPack) => void }) {
  const [presets, setPresets] = useState<DemoPack[]>([]);
  const [view, setView] = useState<PresetView>("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setPresets(getPresets());
      setActiveId(localStorage.getItem("demo-active-preset"));
    };
    refresh();
    window.addEventListener("presets-changed", refresh);
    return () => window.removeEventListener("presets-changed", refresh);
  }, []);

  function persist(updated: DemoPack[]) {
    setPresets(updated);
    savePresets(updated);
  }

  function handleActivate(preset: DemoPack) {
    setActiveId(preset.id);
    localStorage.setItem("demo-active-preset", preset.id);
    onActivate(preset);
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setView("edit");
  }

  function handleDuplicate(preset: DemoPack) {
    persist([...presets, duplicatePreset(preset, newPresetId())]);
  }

  function handleDelete(id: string) {
    persist(presets.filter((p) => p.id !== id));
    if (activeId === id) {
      setActiveId(null);
      localStorage.removeItem("demo-active-preset");
    }
  }

  function handleSaveEdit(updated: DemoPack) {
    persist(presets.map((p) => p.id === updated.id ? updated : p));
    setView("grid");
    setEditingId(null);
  }

  function handleNewPreset() {
    const blank = buildBlankPreset(newPresetId());
    persist([...presets, blank]);
    setEditingId(blank.id);
    setView("edit");
  }

  function handleRestoreSeeded() {
    restoreSeeded();
    setPresets(getPresets());
  }

  const editingPreset = presets.find((p) => p.id === editingId);

  if (view === "edit" && editingPreset) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setView("grid"); setEditingId(null); }}
            style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)" }}>
            Editing: {editingPreset.label}
          </span>
        </div>
        <PresetEditPanel
          preset={editingPreset}
          onSave={handleSaveEdit}
          onCancel={() => { setView("grid"); setEditingId(null); }}
        />
      </div>
    );
  }

  return (
    <PresetLibraryPanel
      presets={presets}
      activeId={activeId}
      onActivate={handleActivate}
      onEdit={handleEdit}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      onNewPreset={handleNewPreset}
      onRestoreSeeded={handleRestoreSeeded}
    />
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export default function SettingsClient({ displayName }: { displayName: string | null }) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Apply stored colors/fonts on mount so live changes persist across navigations.
  useEffect(() => {
    applyStoredBrandingSettings();
    setLastSaved(new Date());
  }, []);

  async function handleSave() {
    const serverSaved = await postBrandingSettings(readSettings());
    if (!serverSaved) return;

    notifyBrandingChanged();
    setLastSaved(new Date());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function handleResetAll() {
    const defaults = {
      accentColor: DEFAULT_ACCENT,
      paperColor: DEFAULT_PAPER,
      textColor: DEFAULT_TEXT,
      headerBgColor: DEFAULT_HEADER_BG,
      headerFgColor: DEFAULT_HEADER_FG,
      inkColor: DEFAULT_INK,
      displayFont: DEFAULT_DISPLAY_FONT,
      bodyFont: DEFAULT_BODY_FONT,
      appName: DEFAULT_APP_NAME,
      logoBase64: null,
    };

    localStorage.setItem("theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
    await persistBrandingSettings(defaults, {
      replace: true,
      brandingEvent: "reset",
      themeChanged: true,
    });

    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function handlePresetActivate(preset: DemoPack) {
    void persistBrandingSettings(buildPresetSettingsPatch(preset));
  }

  async function handleBrandApply(result: BrandResult, sourceUrl?: string) {
    const patch = buildBrandSettingsPatch(result, sourceUrl);
    await persistBrandingSettings(patch);
    setLastSaved(new Date());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function handleBrandSavePreset(result: BrandResult, sourceUrl: string): { preset: DemoPack; action: "created" | "updated" } {
    const upsert = upsertBrandPreset(getPresets(), result, newPresetId(), sourceUrl);
    savePresets(upsert.presets);
    window.dispatchEvent(new CustomEvent("presets-changed"));
    return { preset: upsert.preset, action: upsert.action };
  }

  const sectionGap = "mb-10";

  const savedTime = lastSaved
    ? lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="relative">

      {/* 00 Profile */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="00" title="Profile" /></div>
        <ProfileSection displayName={displayName} />
      </div>

      {/* ── Brand identity group ── */}
      <div style={{
        marginTop: 48,
        marginBottom: 16,
        paddingTop: 16,
        borderTop: "0.5px solid var(--color-border)",
        fontFamily: "var(--font-body)",
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase" as const,
        color: "var(--color-ink-soft)",
      }}>
        Brand identity
      </div>

      {/* 01 Presets */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="01" title="Presets" /></div>
        <PresetsSection onActivate={handlePresetActivate} />
      </div>

      {/* 02 Brand from website */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="02" title="Brand from website" /></div>
        <BrandFromWebsiteSection onApply={handleBrandApply} onSavePreset={handleBrandSavePreset} />
      </div>

      {/* 03 App name & logo */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="03" title="App name &amp; logo" /></div>
        <BrandingSection />
      </div>

      {/* 04 Palette */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="04" title="Palette" /></div>
        <PaletteSection />
      </div>

      {/* 05 Typography */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="05" title="Typography" /></div>
        <TypographySection />
      </div>

      {/* ── end Brand identity group ── */}
      <div style={{ marginTop: 32, marginBottom: 24, borderTop: "0.5px solid var(--color-border)" }} />

      {/* 06 Theme */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="06" title="Theme" /></div>
        <ThemeSection />
      </div>

      {/* 07 Prompts library */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="07" title="Prompts library" /></div>
        <PromptsLibrarySection />
      </div>

      {/* 08 Trust Layer Model */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="08" title="Trust Layer model" /></div>
        <TrustLayerModelSection />
      </div>

      {/* 09 AI provider */}
      <div className={sectionGap}>
        <div className="mb-4"><SectionHeader number="09" title="AI provider" /></div>
        <AiProviderSection />
      </div>

      {/* 10 Connection diagnostics */}
      <div style={{ marginBottom: "72px" }}>
        <div className="mb-4"><SectionHeader number="10" title="Connection diagnostics" /></div>
        <ConnectionDiagnosticsSection />
      </div>

      {/* Sticky save footer */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          background: "var(--color-surface)",
          borderTop: "0.5px solid var(--color-border)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)" }}>
            {savedFlash ? (
              <span style={{ color: "var(--color-success)", fontWeight: 500 }}>✓ Saved</span>
            ) : savedTime ? (
              <>Last saved at <span style={{ color: "var(--color-ink-muted)" }}>{savedTime}</span></>
            ) : (
              "Not yet saved"
            )}
          </p>
          <button
            onClick={handleResetAll}
            style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
          >
            Reset to defaults
          </button>
        </div>
        <button
          onClick={handleSave}
          className="transition-opacity hover:opacity-80"
          style={{
            padding: "6px 18px",
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            fontWeight: 500,
            background: "var(--color-accent)",
            color: "var(--color-accent-foreground)",
            border: "none",
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>

    </div>
  );
}
