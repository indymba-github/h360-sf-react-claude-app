import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import type { McpMode } from "@/lib/mcp-config";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { mode?: string } | null;
  const mode = body?.mode;

  if (mode !== "local" && mode !== "hosted" && mode !== "agentforce") {
    return NextResponse.json({ error: "mode must be 'local', 'hosted', or 'agentforce'" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  session.mcpMode = mode as McpMode;
  await session.save();

  return NextResponse.json({ mode });
}
