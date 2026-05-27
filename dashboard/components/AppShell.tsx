"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import HeaderBar from "./HeaderBar";
import { AiContextProvider } from "@/lib/use-ai-context";
import { applyAccentTokens } from "@/lib/brandColors";

function applyStoredSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("settings") ?? "{}") as Record<string, string>;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (s.accentColor) {
      const palette = (!isDark && s.inkColor && s.paperColor)
        ? { ink: s.inkColor, paper: s.paperColor }
        : undefined;
      applyAccentTokens(s.accentColor, palette);
    }
    // In dark mode, remove any light-mode overrides so dark-mode CSS tokens win
    if (isDark) {
      document.documentElement.style.removeProperty("--color-ink");
      document.documentElement.style.removeProperty("--color-ink-deep");
      document.documentElement.style.removeProperty("--color-paper");
    }
    if (s.displayFont) {
      loadFont(s.displayFont);
      document.documentElement.style.setProperty("--font-display", s.displayFont === "system-ui" ? "system-ui, sans-serif" : `'${s.displayFont}', serif`);
    }
    if (s.bodyFont) {
      loadFont(s.bodyFont);
      document.documentElement.style.setProperty("--font-body", s.bodyFont === "system-ui" ? "system-ui, sans-serif" : `'${s.bodyFont}', sans-serif`);
    }
  } catch {}
}

function loadFont(name: string) {
  if (name === "system-ui" || name === "Inter") return;
  const id = `gf-${name.replace(/ /g, "+")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:ital,wght@0,400;0,500;1,400&display=swap`;
  document.head.appendChild(link);
}

interface AppShellProps {
  children: React.ReactNode;
  displayName?: string;
  instanceUrl?: string;
  appName?: string;
  logoBase64?: string | null;
}

export default function AppShell({ children, displayName, appName, logoBase64 }: AppShellProps) {
  const pathname = usePathname();
  const isPublic = pathname === "/";

  useEffect(() => { applyStoredSettings(); }, [pathname]);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AiContextProvider>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: "var(--color-paper)" }}
      >
        <HeaderBar
          appName={appName ?? "Cumulus Bank"}
          logoSrc={logoBase64}
          userName={displayName}
        />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </AiContextProvider>
  );
}
