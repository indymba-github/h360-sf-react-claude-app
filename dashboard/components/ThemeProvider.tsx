"use client";

import { useEffect } from "react";
import { applyBrandTokens } from "@/lib/brandColors";
import { migratePalette } from "@/lib/demoPacks";

type ThemePreference = "light" | "dark" | "system";

function applyTheme(pref: ThemePreference) {
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  // Reapply brand tokens now that data-theme is set — applyBrandTokens is
  // theme-aware and will correctly set or clear surface vars for the new mode
  try {
    const s = JSON.parse(localStorage.getItem("settings") ?? "{}") as Record<string, string>;
    if (s.accentColor) {
      const legacyInk = s.inkColor ?? "#1B1F2A";
      applyBrandTokens(s.accentColor, migratePalette({
        accent:   s.accentColor,
        paper:    s.paperColor    ?? "#F4F1EA",
        text:     s.textColor     ?? legacyInk,
        headerBg: s.headerBgColor ?? legacyInk,
        headerFg: s.headerFgColor ?? (s.paperColor ?? "#F4F1EA"),
      }));
    }
  } catch {}
}

export default function ThemeProvider() {
  useEffect(() => {
    const stored = (localStorage.getItem("theme") ?? "light") as ThemePreference;
    applyTheme(stored);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = () => {
      const current = (localStorage.getItem("theme") ?? "light") as ThemePreference;
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", mqHandler);

    // theme-changed fires when Settings changes the theme or resets all
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
