"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SFNotification } from "@/app/api/notifications/route";

export type { SFNotification };

const STORAGE_KEY = "sf_notif_last_seen";

export function useNotificationPoller() {
  const router = useRouter();
  const [alerts, setAlerts]      = useState<SFNotification[]>([]);
  const [unreadCount, setUnread] = useState(0);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const { alerts: fresh, count }: { alerts: SFNotification[]; count: number } = await res.json();

      const raw      = sessionStorage.getItem(STORAGE_KEY);
      const lastSeen = raw !== null ? parseInt(raw, 10) : null;

      setAlerts(fresh);

      if (lastSeen === null) {
        // First load — seed so existing alerts don't show as "new"
        sessionStorage.setItem(STORAGE_KEY, String(count));
        setUnread(0);
      } else {
        const newCount = Math.max(0, count - lastSeen);
        setUnread(newCount);
        // Only refresh server components when genuinely new alerts arrive mid-session
        if (count > lastSeen) {
          router.refresh();
        }
      }
    } catch {
      // Silently swallow network errors — bell will just show stale data
    }
  }, [router]);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const markAllSeen = useCallback(() => {
    setAlerts(prev => {
      sessionStorage.setItem(STORAGE_KEY, String(prev.length));
      return prev;
    });
    setUnread(0);
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      sessionStorage.setItem(STORAGE_KEY, String(next.length));
      return next;
    });
    setUnread(prev => Math.max(0, prev - 1));

    await fetch("/api/salesforce/dismiss-alert", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ taskId: id }),
    });
  }, []);

  return { alerts, unreadCount, markAllSeen, dismissAlert };
}
