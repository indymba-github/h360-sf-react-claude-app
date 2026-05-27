"use client";

import { useAiContext } from "@/lib/use-ai-context";

interface ActionChip {
  label: string;
  prompt: string;
}

export default function ActionChips({ accountName, chips }: { accountName: string; chips: ActionChip[] }) {
  const { sendPrompt } = useAiContext();

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ label, prompt }) => (
        <button
          key={label}
          onClick={() => sendPrompt(prompt.replace("{{account}}", accountName))}
          className="flex items-center gap-1.5 transition-all"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            padding: "4px 10px",
            color: "var(--color-accent-text)",
            background: "transparent",
            border: "0.5px dashed var(--color-accent-soft)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))";
            (e.currentTarget as HTMLElement).style.borderStyle = "solid";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderStyle = "dashed";
          }}
        >
          <svg
            className="w-3 h-3 shrink-0"
            fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}
            style={{ color: "var(--color-accent-text)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {label}
        </button>
      ))}
    </div>
  );
}
