"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";
import type { SFNotification } from "@/hooks/useNotificationPoller";

interface SidebarProps {
  displayName?: string;
  instanceUrl?: string;
  appName?: string;
  logoBase64?: string | null;
  sidebarStyle?: "dark" | "light";
  onClose?: () => void;
  notifAlerts?:     SFNotification[];
  notifUnread?:     number;
  onNotifMarkSeen?: () => void;
  onNotifDismiss?:  (id: string) => void;
}

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    href: "/accounts",
    label: "Accounts",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

export default function Sidebar({ displayName, instanceUrl, appName, logoBase64, sidebarStyle = "dark", onClose, notifAlerts, notifUnread, onNotifMarkSeen, onNotifDismiss }: SidebarProps) {
  const pathname = usePathname();
  const isLight = sidebarStyle === "light";

  const orgLabel = instanceUrl
    ? instanceUrl.replace("https://", "").split(".")[0]
    : null;

  const label = appName ?? "SF Dashboard";

  // Colour tokens that differ between dark and light sidebar modes
  const bg          = isLight ? "white" : "var(--color-primary)";
  const border      = isLight ? "#e5e7eb" : "rgba(0,0,0,0.15)";
  const divider     = isLight ? "#f3f4f6" : "rgba(255,255,255,0.12)";
  const logoBoxBg   = isLight ? "color-mix(in srgb, var(--color-primary) 12%, white)" : "rgba(255,255,255,0.15)";
  const logoIconCol = isLight ? "var(--color-primary)" : "white";
  const nameCol     = isLight ? "var(--color-primary)" : "white";
  const activeNavBg = isLight ? "color-mix(in srgb, var(--color-primary) 10%, white)" : "rgba(255,255,255,0.15)";
  const activeNavFg = isLight ? "var(--color-primary)" : "white";
  const inactiveNavFg = isLight ? "#6b7280" : "rgba(255,255,255,0.6)";
  const hoverNavBg  = isLight
    ? "color-mix(in srgb, var(--color-secondary) 10%, white)"
    : "color-mix(in srgb, var(--color-secondary) 20%, transparent)";
  const hoverNavFg  = isLight ? "var(--color-secondary)" : "white";
  const userNameCol = isLight ? "#111827" : "white";
  const userOrgCol  = isLight ? "#9ca3af" : "rgba(255,255,255,0.45)";
  const logoutCol   = isLight ? "#6b7280" : "rgba(255,255,255,0.6)";
  const logoutHoverBg = isLight ? "#f9fafb" : "rgba(255,255,255,0.1)";
  const logoutHoverFg = isLight ? "#111827" : "white";
  const avatarBg    = isLight
    ? "color-mix(in srgb, var(--color-secondary) 80%, white)"
    : "color-mix(in srgb, var(--color-secondary) 60%, rgba(0,0,0,0.3))";

  return (
    <aside
      className="flex flex-col w-60 h-full border-r shrink-0"
      style={{ background: bg, borderColor: border }}
    >
      {/* Logo + close button (mobile) */}
      <div
        className="flex items-center gap-2.5 px-5 py-5 border-b"
        style={{ borderColor: divider }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 overflow-hidden"
          style={{ background: logoBoxBg }}
        >
          {logoBase64 ? (
            <img src={logoBase64} alt={label} className="w-6 h-6 object-contain" />
          ) : (
            <svg className="w-4 h-4" style={{ color: logoIconCol }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5Zm-1 4v4.586l-2.293 2.293 1.414 1.414L13 14.414V9h-2Z" />
            </svg>
          )}
        </div>
        <span className="text-sm font-semibold tracking-tight flex-1 truncate" style={{ color: nameCol }}>{label}</span>
        {notifAlerts !== undefined && (
          <NotificationBell
            alerts={notifAlerts}
            unreadCount={notifUnread ?? 0}
            onMarkSeen={onNotifMarkSeen ?? (() => {})}
            onDismiss={onNotifDismiss ?? (() => {})}
          />
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="transition-colors md:hidden"
            style={{ color: isLight ? "#9ca3af" : "rgba(255,255,255,0.5)" }}
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label: navLabel, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                background: active ? activeNavBg : "transparent",
                color: active ? activeNavFg : inactiveNavFg,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = hoverNavBg;
                  (e.currentTarget as HTMLElement).style.color = hoverNavFg;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = inactiveNavFg;
                }
              }}
            >
              {icon}
              {navLabel}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: divider }}>
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold select-none shrink-0"
            style={{ background: avatarBg }}
          >
            {displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: userNameCol }}>
              {displayName ?? "Salesforce User"}
            </p>
            {orgLabel && (
              <p className="text-xs truncate" style={{ color: userOrgCol }}>{orgLabel}</p>
            )}
          </div>
        </div>
        <a
          href="/api/auth/logout"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors"
          style={{ color: logoutCol }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = logoutHoverBg;
            (e.currentTarget as HTMLElement).style.color = logoutHoverFg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = logoutCol;
          }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          Sign out
        </a>
      </div>
    </aside>
  );
}
