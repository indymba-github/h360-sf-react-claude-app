"use client";

import { useEffect } from "react";

type ThemePreference = "light" | "dark" | "system";

function applyTheme(pref: ThemePreference) {
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  // Inline styles from applyStoredSettings override CSS [data-theme] rules — remove them in dark mode
  if (isDark) {
    document.documentElement.style.removeProperty("--color-ink");
    document.documentElement.style.removeProperty("--color-paper");
  } else {
    try {
      const s = JSON.parse(localStorage.getItem("settings") ?? "{}") as Record<string, string>;
      if (s.inkColor)   document.documentElement.style.setProperty("--color-ink",   s.inkColor);
      if (s.paperColor) document.documentElement.style.setProperty("--color-paper", s.paperColor);
    } catch {}
  }
}

export default function ThemeProvider() {
  useEffect(() => {
    const stored = (localStorage.getItem("theme") ?? "light") as ThemePreference;
    applyTheme(stored);

    // Listen for OS theme changes when pref is "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = () => {
      const current = (localStorage.getItem("theme") ?? "light") as ThemePreference;
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", mqHandler);

    // Listen for programmatic theme resets (e.g. Reset to defaults)
    const resetHandler = () => {
      const current = (localStorage.getItem("theme") ?? "light") as ThemePreference;
      applyTheme(current);
    };
    window.addEventListener("theme-changed", resetHandler);

    return () => {
      mq.removeEventListener("change", mqHandler);
      window.removeEventListener("theme-changed", resetHandler);
    };
  }, []);

  return null;
}
