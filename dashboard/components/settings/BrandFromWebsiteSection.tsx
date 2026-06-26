"use client";

import { useState } from "react";
import BrandPreviewCard from "@/components/settings/BrandPreviewCard";
import { findMatchingBrandPreset, type ExtractedBrandResult } from "@/lib/brand-settings";
import { formatBrandPresetSaveMessage, type BrandPresetSaveAction } from "@/lib/brand-extraction";
import { getPresets, type DemoPack } from "@/lib/demoPacks";

type BrandResult = ExtractedBrandResult;

interface BrandFromWebsiteSectionProps {
  onApply: (result: BrandResult, sourceUrl: string) => void;
  onSavePreset: (
    result: BrandResult,
    sourceUrl: string
  ) => { preset: DemoPack; action: BrandPresetSaveAction };
}

function TextInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm outline-none"
      style={{
        background: "var(--color-paper)",
        border: "0.5px solid var(--color-border)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-body)",
        fontSize: "12px",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent-soft)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
    />
  );
}

export default function BrandFromWebsiteSection({ onApply, onSavePreset }: BrandFromWebsiteSectionProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandResult | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const trimmedUrl = url.trim();
  const presetAction = result && findMatchingBrandPreset(getPresets(), result, trimmedUrl) ? "update" : "create";

  async function handleExtract() {
    if (!trimmedUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/settings/extract-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const data = await res.json() as BrandResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Extraction failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSavePreset() {
    if (!result) return;
    const { preset, action } = onSavePreset(result, trimmedUrl);
    setSavedMsg(formatBrandPresetSaveMessage(preset.label, action));
  }

  return (
    <div className="p-5 space-y-5" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-ink-soft)", lineHeight: 1.5 }}>
        Paste your company&rsquo;s website URL and we&rsquo;ll extract brand colors and fonts automatically using AI.
      </p>
      <div className="flex gap-2">
        <TextInput
          value={url}
          onChange={setUrl}
          placeholder="https://acme.com"
        />
        <button
          onClick={handleExtract}
          disabled={loading || !trimmedUrl}
          className="shrink-0 px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: "var(--color-ink)", color: "var(--color-paper)", fontFamily: "var(--font-body)", fontSize: "11px", whiteSpace: "nowrap" }}
        >
          {loading ? "Extracting..." : "Extract"}
        </button>
      </div>
      {error && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-danger)" }}>{error}</p>
      )}
      {result && (
        <BrandPreviewCard
          result={result}
          sourceUrl={trimmedUrl}
          onApply={() => onApply(result, trimmedUrl)}
          onSavePreset={handleSavePreset}
          presetAction={presetAction}
        />
      )}
      {savedMsg && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-success)" }}>{savedMsg}</p>
      )}
    </div>
  );
}
