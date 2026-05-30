import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export interface SFNotification {
  id:          string;
  subject:     string;
  priority:    string | null;
  accountId:   string | null;
  accountName: string | null;
  createdDate: string;
}

export async function GET() {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const soql = `SELECT Id, Subject, Priority, WhatId, What.Name, CreatedDate FROM Task WHERE Subject LIKE 'News Alert:%' AND Status != 'Completed' ORDER BY CreatedDate DESC LIMIT 10`;
  const url  = `${session.instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Query failed" }, { status: res.status });
  }

  const data = await res.json();
  const alerts: SFNotification[] = (data.records ?? []).map((r: Record<string, unknown> & { What?: { Name?: string } }) => ({
    id:          r.Id,
    subject:     (r.Subject as string | null)?.replace(/^News Alert:\s*/i, "") ?? "(no subject)",
    priority:    r.Priority ?? null,
    accountId:   r.WhatId ?? null,
    accountName: r.What?.Name ?? null,
    createdDate: r.CreatedDate,
  }));

  return NextResponse.json({ alerts, count: alerts.length });
}
