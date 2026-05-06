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

  // Validate hex colors if provided
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  if (body.primaryColor && !hexRe.test(body.primaryColor)) {
    return NextResponse.json({ error: "Invalid primaryColor — must be a 6-digit hex (e.g. #2D5BFF)" }, { status: 400 });
  }
  if (body.secondaryColor && !hexRe.test(body.secondaryColor)) {
    return NextResponse.json({ error: "Invalid secondaryColor" }, { status: 400 });
  }
  if (body.accentColor && !hexRe.test(body.accentColor)) {
    return NextResponse.json({ error: "Invalid accentColor" }, { status: 400 });
  }
  if (body.appName && body.appName.length > 30) {
    return NextResponse.json({ error: "appName must be 30 characters or fewer" }, { status: 400 });
  }
  if (body.borderRadius !== undefined && (body.borderRadius < 0 || body.borderRadius > 16)) {
    return NextResponse.json({ error: "borderRadius must be 0–16" }, { status: 400 });
  }
  if (body.sidebarStyle && !["dark", "light"].includes(body.sidebarStyle)) {
    return NextResponse.json({ error: "sidebarStyle must be 'dark' or 'light'" }, { status: 400 });
  }

  const updated = saveSettings(body);
  return NextResponse.json(updated);
}
