"use client";

import { useEffect, useRef, useState } from "react";
import PresetPreview from "@/components/PresetPreview";
import type { DemoPack } from "@/lib/demoPacks";

interface PresetLibraryPanelProps {
  presets: DemoPack[];
  activeId: string | null;
  onActivate: (preset: DemoPack) => void;
  onEdit: (id: string) => void;
  onDuplicate: (preset: DemoPack) => void;
  onDelete: (id: string) => void;
  onNewPreset: () => void;
  onRestoreSeeded: () => void;
}

function KebabMenu({ onEdit, onDuplicate, onDelete, isSeeded }: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isSeeded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          width: 22, height: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--color-ink-soft)",
          borderRadius: 2,
        }}
        title="Options"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "100%", zIndex: 50,
            background: "var(--color-surface)",
            border: "0.5px solid var(--color-border)",
            minWidth: 110,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {[
            { label: "Edit", action: onEdit },
            { label: "Duplicate", action: onDuplicate },
            ...(!isSeeded ? [{ label: "Delete", action: onDelete, danger: true }] : []),
          ].map(({ label, action, danger }) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); action(); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "7px 12px",
                fontFamily: "var(--font-body)", fontSize: "12px",
                color: danger ? "var(--color-danger)" : "var(--color-ink)",
                background: "transparent", border: "none", cursor: "pointer",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PresetLibraryPanel({
  presets,
  activeId,
  onActivate,
  onEdit,
  onDuplicate,
  onDelete,
  onNewPreset,
  onRestoreSeeded,
}: PresetLibraryPanelProps) {
  return (
    <div className="p-5 space-y-5" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", lineHeight: 1.5 }}>
        Activate a preset to instantly switch the app&rsquo;s branding. Edit or create custom presets to save client-specific themes.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {presets.map((preset) => {
          const isActive = activeId === preset.id;
          return (
            <div
              key={preset.id}
              style={{
                border: isActive ? "1.5px solid var(--color-accent)" : "0.5px solid var(--color-border)",
                background: "var(--color-paper)",
                cursor: "pointer",
                position: "relative",
                transition: "border-color 100ms",
              }}
              onClick={() => onActivate(preset)}
            >
              {isActive && (
                <div style={{
                  position: "absolute", top: 5, left: 5, zIndex: 1,
                  fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase",
                  background: "var(--color-accent)", color: "var(--color-accent-foreground)",
                  padding: "1px 5px", fontFamily: "var(--font-body)",
                }}>
                  Active
                </div>
              )}

              <div style={{ position: "absolute", top: 4, right: 4, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
                <KebabMenu
                  onEdit={() => onEdit(preset.id)}
                  onDuplicate={() => onDuplicate(preset)}
                  onDelete={() => onDelete(preset.id)}
                  isSeeded={!preset.isCustom}
                />
              </div>

              <div style={{ padding: 8 }}>
                <PresetPreview preset={preset} size="mini" />
              </div>

              <div style={{ padding: "0 8px 8px" }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 500, color: "var(--color-ink)", marginBottom: 2 }}>
                  {preset.label}
                </p>
                {preset.description && (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--color-ink-soft)", lineHeight: 1.3 }}>
                    {preset.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={onNewPreset}
          style={{
            border: "0.5px dashed var(--color-border)",
            background: "transparent",
            cursor: "pointer",
            minHeight: 120,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            color: "var(--color-ink-soft)",
            transition: "border-color 100ms, color 100ms",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-ink-soft)"; }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "11px" }}>New preset</span>
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onRestoreSeeded}
          style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
          className="transition-opacity hover:opacity-60"
        >
          Restore default presets
        </button>
      </div>
    </div>
  );
}
