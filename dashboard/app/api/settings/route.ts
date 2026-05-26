import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Partial<AppSettings> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const hexRe = /^#[0-9a-fA-F]{6}$/;
  if (body.accentColor && !hexRe.test(body.accentColor)) {
    return NextResponse.json({ error: "Invalid accentColor — must be a 6-digit hex (e.g. #946F1F)" }, { status: 400 });
  }
  if (body.inkColor && !hexRe.test(body.inkColor)) {
    return NextResponse.json({ error: "Invalid inkColor — must be a 6-digit hex" }, { status: 400 });
  }
  if (body.appName && body.appName.length > 30) {
    return NextResponse.json({ error: "appName must be 30 characters or fewer" }, { status: 400 });
  }

  const updated = saveSettings(body);
  return NextResponse.json(updated);
}
