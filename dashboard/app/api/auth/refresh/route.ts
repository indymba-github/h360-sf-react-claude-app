import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { refreshSession } from "@/lib/token-refresh";

export async function POST() {
  const session = await getSession();
  if (!session.refreshToken || !session.instanceUrl) {
    return NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
  }

  try {
    await refreshSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Token refresh error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "refresh_failed" },
      { status: 401 }
    );
  }
}
