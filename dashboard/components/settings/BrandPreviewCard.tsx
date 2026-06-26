"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { summarizeBrandExtraction, type ExtractedBrandResult } from "@/lib/brand-settings";

type BrandPresetAction = "create" | "update";

interface BrandPreviewCardProps {
  result: ExtractedBrandResult;
  sourceUrl: string;
  onApply: () => void;
  onSavePreset: () => void;
  presetAction: BrandPresetAction;
}

export default function BrandPreviewCard({
  result,
  sourceUrl,
  onApply,
  onSavePreset,
  presetAction,
}: BrandPreviewCardProps) {
  const summary = summarizeBrandExtraction(result, sourceUrl);
  const labelStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "9px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--color-ink-soft)",
  };
  const valueStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "11px",
    color: "var(--color-ink-muted)",
  };

  return (
    <div className="p-4 space-y-4" style={{ background: "var(--color-paper)", border: "0.5px solid var(--color-border)", marginTop: 4 }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 500, color: "var(--color-ink)" }}>
        {summary.displayName}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p style={labelStyle}>Logo</p>
          {result.logo ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
                <Image src={result.logo} alt={`${summary.displayName} logo`} width={24} height={24} unoptimized style={{ objectFit: "contain" }} />
              </div>
              <p style={valueStyle}>Found</p>
            </div>
          ) : (
            <p style={valueStyle}>{summary.hasLogoUrlOnly ? "Found, preview unavailable" : "Not found"}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p style={labelStyle}>Colors</p>
          {summary.colors.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {summary.colors.slice(0, 6).map((color, index) => (
                <div
                  key={index}
                  title={color}
                  style={{ width: 24, height: 24, background: color, border: "0.5px solid var(--color-border)" }}
                />
              ))}
            </div>
          ) : (
            <p style={valueStyle}>Not found</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p style={labelStyle}>Fonts</p>
          <p style={valueStyle}>{summary.fonts.length > 0 ? summary.fonts.join(" / ") : "Not found"}</p>
        </div>
      </div>

      {!summary.hasThemeDetails && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", lineHeight: 1.5 }}>
          {summary.hasLogoUrlOnly ? "A logo URL was found, but it could not be saved. Applying keeps existing colors and logo unchanged." : "Only the name was extracted. Applying keeps existing colors and logo unchanged."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onApply}
          className="px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)", fontFamily: "var(--font-body)", fontSize: "11px" }}
        >
          Apply to settings
        </button>
        <button
          onClick={onSavePreset}
          disabled={!summary.hasThemeDetails}
          title={summary.hasThemeDetails ? undefined : "No theme details to save"}
          className="px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--color-paper)", color: "var(--color-ink-muted)", border: "0.5px solid var(--color-border)", fontFamily: "var(--font-body)", fontSize: "11px" }}
        >
          {presetAction === "update" ? "Update preset" : "Save as preset"}
        </button>
      </div>
    </div>
  );
}
