"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import PresetPreview from "@/components/PresetPreview";
import type { DemoPack } from "@/lib/demoPacks";
import { BODY_FONT_OPTIONS, DISPLAY_FONT_OPTIONS } from "@/lib/branding-options";
import { getPresetLogoCaption } from "@/lib/preset-editor";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-soft)", marginBottom: "6px" }}>
      {children}
    </p>
  );
}

interface PresetEditPanelProps {
  preset: DemoPack;
  onSave: (updated: DemoPack) => void;
  onCancel: () => void;
}

export default function PresetEditPanel({ preset, onSave, onCancel }: PresetEditPanelProps) {
  const [draft, setDraft] = useState<DemoPack>({ ...preset });
  const [logoMode, setLogoMode] = useState<"idle" | "url">("idle");
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoUrlError, setLogoUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof DemoPack>(key: K, val: DemoPack[K]) {
    setDraft((p) => ({ ...p, [key]: val }));
  }

  function setPalette(key: keyof DemoPack["palette"], val: string) {
    setDraft((p) => ({ ...p, palette: { ...p.palette, [key]: val } }));
  }

  function setTypo(key: keyof DemoPack["typography"], val: string) {
    setDraft((p) => ({ ...p, typography: { ...p.typography, [key]: val } }));
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { setLogoUrlError("Logo must be 200 KB or smaller."); return; }
    setLogoUrlError(null);
    const reader = new FileReader();
    reader.onload = () => { set("logoDataUrl", reader.result as string); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleLogoUrl() {
    const url = logoUrlInput.trim();
    if (!url.startsWith("https://")) { setLogoUrlError("URL must start with https://"); return; }
    setLogoUrlError(null);
    set("logoDataUrl", url);
    setLogoMode("idle");
    setLogoUrlInput("");
  }

  function removeLogo() {
    set("logoDataUrl", null);
    setLogoMode("idle");
    setLogoUrlInput("");
    setLogoUrlError(null);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "5px 8px", fontSize: "12px",
    fontFamily: "var(--font-body)", background: "var(--color-paper)",
    border: "0.5px solid var(--color-border)", color: "var(--color-ink)", outline: "none",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle };

  return (
    <div className="p-5 space-y-5" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
      <div className="grid gap-5" style={{ gridTemplateColumns: "264px 1fr" }}>
        <div>
          <FieldLabel>Preview</FieldLabel>
          <PresetPreview preset={draft} size="large" />
        </div>

        <div className="space-y-4">
          <div>
            <FieldLabel>Label</FieldLabel>
            <input style={inputStyle} value={draft.label} maxLength={30} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div>
            <FieldLabel>App name</FieldLabel>
            <input style={inputStyle} value={draft.appName} maxLength={30} onChange={(e) => set("appName", e.target.value)} />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <input style={inputStyle} value={draft.description} maxLength={80} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Logo</FieldLabel>
            <div className="flex gap-2 mb-2">
              <label
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", cursor: "pointer",
                  fontFamily: "var(--font-body)", fontSize: "11px",
                  color: "var(--color-ink-muted)",
                  background: "var(--color-paper)",
                  border: "0.5px solid var(--color-border)",
                }}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                Upload file
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="sr-only"
                  onChange={handleLogoFile}
                />
              </label>
              <button
                type="button"
                onClick={() => setLogoMode((m) => m === "url" ? "idle" : "url")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", cursor: "pointer",
                  fontFamily: "var(--font-body)", fontSize: "11px",
                  color: logoMode === "url" ? "var(--color-accent-text)" : "var(--color-ink-muted)",
                  background: "var(--color-paper)",
                  border: logoMode === "url" ? "0.5px solid var(--color-accent)" : "0.5px solid var(--color-border)",
                }}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                Paste URL
              </button>
            </div>

            {logoMode === "url" && (
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={logoUrlInput}
                  onChange={(e) => { setLogoUrlInput(e.target.value); setLogoUrlError(null); }}
                  placeholder="https://example.com/logo.svg"
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogoUrl(); if (e.key === "Escape") setLogoMode("idle"); }}
                  style={{ ...inputStyle, flex: 1 }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleLogoUrl}
                  style={{ padding: "4px 10px", fontFamily: "var(--font-body)", fontSize: "11px", background: "var(--color-ink)", color: "var(--color-paper)", border: "none", cursor: "pointer" }}
                >
                  Use
                </button>
              </div>
            )}

            {logoUrlError && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)", marginBottom: 6 }}>{logoUrlError}</p>
            )}

            <div className="flex items-center gap-3">
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                background: "var(--color-surface)",
                border: "0.5px solid var(--color-border)",
                borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {draft.logoDataUrl ? (
                  <Image src={draft.logoDataUrl} alt="Logo" width={32} height={32} unoptimized style={{ objectFit: "contain" }} />
                ) : (
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--color-ink-soft)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75 7.409 10.59a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                )}
              </div>
              <div>
                {draft.logoDataUrl ? (
                  <>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-muted)" }}>{getPresetLogoCaption(draft.logoDataUrl)}</p>
                    <button
                      type="button"
                      onClick={removeLogo}
                      style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", fontStyle: "italic" }}>No logo set</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Palette</FieldLabel>
            <div className="flex flex-wrap gap-4">
              {(["accent", "paper", "text", "headerBg", "headerFg"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.palette[key]}
                    onChange={(e) => setPalette(key, e.target.value)}
                    style={{ width: 28, height: 22, padding: 0, border: "0.5px solid var(--color-border)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "10px", fontFamily: "var(--font-body)", color: "var(--color-ink-muted)" }}>
                    {key === "headerBg" ? "Header" : key === "headerFg" ? "Header text" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Display font</FieldLabel>
              <select style={selectStyle} value={draft.typography.display} onChange={(e) => setTypo("display", e.target.value)}>
                {DISPLAY_FONT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Body font</FieldLabel>
              <select style={selectStyle} value={draft.typography.body} onChange={(e) => setTypo("body", e.target.value)}>
                {BODY_FONT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", background: "none", border: "0.5px solid var(--color-border)", padding: "5px 14px", cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(draft)}
          style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-accent-foreground)", background: "var(--color-accent)", border: "none", padding: "5px 14px", cursor: "pointer", fontWeight: 500 }}
        >
          Save preset
        </button>
      </div>
    </div>
  );
}
