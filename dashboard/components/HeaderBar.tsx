"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotificationPoller } from "@/hooks/useNotificationPoller";
import NotificationBell from "./NotificationBell";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
];

interface HeaderBarProps {
  appName: string;
  logoSrc?: string | null;
  userName?: string;
}

function readBrandingFromStorage(serverAppName: string, serverLogoSrc: string | null | undefined) {
  try {
    const raw = localStorage.getItem("settings");
    if (!raw) return { appName: serverAppName, logoSrc: serverLogoSrc };
    const s = JSON.parse(raw) as Record<string, string | null | undefined>;
    // Use localStorage value when present; "hasOwnProperty" check lets explicit null mean "use default"
    const appName = typeof s.appName === "string" ? s.appName : serverAppName;
    // If logoBase64 key exists (even as null), trust localStorage; otherwise fall back to server prop
    const logoSrc = "logoBase64" in s ? (s.logoBase64 ?? null) : serverLogoSrc;
    return { appName, logoSrc };
  } catch {
    return { appName: serverAppName, logoSrc: serverLogoSrc };
  }
}

export default function HeaderBar({ appName: serverAppName, logoSrc: serverLogoSrc, userName }: HeaderBarProps) {
  const pathname = usePathname();
  const { alerts, unreadCount, markAllSeen, dismissAlert } = useNotificationPoller();

  const [appName, setAppName] = useState(serverAppName);
  const [logoSrc, setLogoSrc] = useState<string | null | undefined>(serverLogoSrc);

  useEffect(() => {
    // Keep the header in sync with settings changes without requiring a reload.
    const handler = () => {
      const { appName: n, logoSrc: l } = readBrandingFromStorage(serverAppName, serverLogoSrc);
      setAppName(n);
      setLogoSrc(l);
    };
    window.addEventListener("branding-changed", handler);
    window.addEventListener("branding-reset", handler);
    return () => {
      window.removeEventListener("branding-changed", handler);
      window.removeEventListener("branding-reset", handler);
    };
  }, [serverAppName, serverLogoSrc]);

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <header
      className="flex items-center gap-6 shrink-0 w-full"
      style={{
        background: "var(--color-header-bg)",
        color: "var(--color-header-fg)",
        padding: "18px 24px",
      }}
    >
      {/* Brand */}
      <div className="flex items-center shrink-0" style={{ gap: "10px" }}>
        <div
          className="flex items-center justify-center overflow-hidden shrink-0"
          style={{ width: 30, height: 30, borderRadius: 3, background: "color-mix(in srgb, var(--color-header-fg) 12%, transparent)" }}
        >
          <Image
            src={logoSrc ?? "/cumulus-logo.svg"}
            alt={appName}
            width={26}
            height={26}
            unoptimized
            style={{ objectFit: "contain" }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "18px",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--color-header-fg)",
          }}
        >
          {appName}
        </span>
      </div>

      {/* Primary nav */}
      <nav className="flex items-center gap-1 flex-1">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="relative px-3 py-1 transition-colors"
              style={{
                fontSize: "13px",
                color: active
                  ? "var(--color-header-fg)"
                  : "color-mix(in srgb, var(--color-header-fg) 50%, transparent)",
                letterSpacing: "0.04em",
              }}
            >
              {label}
              {active && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-px"
                  style={{ background: "var(--color-accent-soft)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Notification bell */}
      <NotificationBell alerts={alerts} unreadCount={unreadCount} onMarkSeen={markAllSeen} onDismiss={dismissAlert} />

      {/* User identity */}
      <div className="flex items-center gap-3 shrink-0">
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-header-fg)" }}>
          {userName ?? "User"}
        </p>
        <div
          className="flex items-center justify-center rounded-full font-semibold shrink-0 select-none"
          style={{ width: 32, height: 32, fontSize: "12px", background: "var(--color-accent-soft)", color: "var(--color-accent-foreground)" }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
