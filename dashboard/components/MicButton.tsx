"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── SpeechRecognition type stubs ──────────────────────────────────────────
// The browser API is inconsistently typed across TS versions; define what we need.

interface SRAlternative { transcript: string; confidence: number }
interface SRResult      { isFinal: boolean; [i: number]: SRAlternative }
interface SRResultList  { length: number; [i: number]: SRResult }
interface SREvent       { resultIndex: number; results: SRResultList }
interface SRErrorEvent  { error: string }
interface SRInstance {
  continuous:     boolean;
  interimResults: boolean;
  lang:           string;
  onstart:        (() => void)         | null;
  onresult:       ((e: SREvent) => void)      | null;
  onerror:        ((e: SRErrorEvent) => void) | null;
  onend:          (() => void)         | null;
  start:  () => void;
  stop:   () => void;
  abort:  () => void;
}
interface SRConstructor { new(): SRInstance }

declare global {
  interface Window {
    SpeechRecognition:       SRConstructor | undefined;
    webkitSpeechRecognition: SRConstructor | undefined;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────

export interface MicButtonProps {
  onTranscriptionUpdate: (text: string, isFinal: boolean) => void;
  onRecordingChange: (recording: boolean) => void;
  onDenied?: () => void;
  disabled?: boolean;
  "data-mic-button"?: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────

function MicIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
        <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A7 7 0 0 0 19 11Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3M9 21h6" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MicButton({ onTranscriptionUpdate, onRecordingChange, onDenied, disabled = false, "data-mic-button": dataMicButton }: MicButtonProps) {
  const [supported,  setSupported]  = useState<boolean | null>(null); // null = not yet checked
  const [recording,  setRecording]  = useState(false);
  const [denied,     setDenied]     = useState(false);
  const recognitionRef = useRef<SRInstance | null>(null);
  const recordingRef   = useRef(false);        // sync shadow for pointer handlers
  const timeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feature-detect on mount (client only — window not available during SSR)
  useEffect(() => {
    setSupported(!!(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  }, []);

  const startRecording = useCallback(() => {
    if (recordingRef.current || denied) return;

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = "en-US";

    rec.onstart = () => {
      recordingRef.current = true;
      setRecording(true);
      onRecordingChange(true);

      // 60-second auto-stop
      timeoutRef.current = setTimeout(() => stopRecording(), 60_000);
    };

    rec.onresult = (e: SREvent) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final   += text;
        else                       interim += text;
      }
      if (final)   onTranscriptionUpdate(final,   true);
      if (interim) onTranscriptionUpdate(interim, false);
    };

    rec.onerror = (e: SRErrorEvent) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setDenied(true);
        onDenied?.();
      }
      stopRecording();
    };

    rec.onend = () => {
      if (recordingRef.current) {
        // Browser ended it (e.g. silence timeout) — clean up gracefully
        recordingRef.current = false;
        setRecording(false);
        onRecordingChange(false);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch {
      // Recognition already started or another error — ignore
    }
  }, [denied, onTranscriptionUpdate, onRecordingChange]);

  const stopRecording = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    recordingRef.current = false;
    setRecording(false);
    onRecordingChange(false);
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
  }, [onRecordingChange]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    recognitionRef.current?.abort();
  }, []);

  // Not yet feature-detected, or not supported, or permission denied → render nothing
  if (supported === null || !supported || denied) return null;

  return (
    <button
      type="button"
      aria-label={recording ? "Stop recording" : "Hold to record voice input"}
      data-mic-button={dataMicButton}
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
      onPointerUp={stopRecording}
      onPointerLeave={stopRecording}
      onPointerCancel={stopRecording}
      style={{
        position:   "relative",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        width:      "36px",
        height:     "36px",
        flexShrink: 0,
        border:     "none",
        cursor:     disabled ? "not-allowed" : "pointer",
        opacity:    disabled ? 0.4 : 1,
        borderRadius: "3px",
        background: recording
          ? "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))"
          : "transparent",
        color: recording ? "var(--color-accent)" : "var(--color-ink-muted)",
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!recording) {
          (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-ink)";
        }
      }}
      onMouseLeave={(e) => {
        if (!recording) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--color-ink-muted)";
        }
      }}
    >
      {/* Pulsing ring — only while recording */}
      {recording && (
        <span
          aria-hidden="true"
          style={{
            position:     "absolute",
            inset:        "-2px",
            borderRadius: "5px",
            border:       "2px solid var(--color-accent)",
            animation:    "micRing 1.2s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <MicIcon filled={recording} size={17} />
    </button>
  );
}
