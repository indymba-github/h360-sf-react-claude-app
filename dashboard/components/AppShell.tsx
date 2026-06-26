"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import HeaderBar from "./HeaderBar";
import { AiContextProvider } from "@/lib/use-ai-context";
import { applyStoredBrandingSettings } from "@/lib/branding-client";

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

  useEffect(() => { applyStoredBrandingSettings(); }, [pathname]);

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
