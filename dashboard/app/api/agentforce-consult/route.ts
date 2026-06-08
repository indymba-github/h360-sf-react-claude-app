import { NextRequest, NextResponse } from "next/server";
import { handleAskAgentforce } from "@/lib/agentforce-tool";

export async function POST(request: NextRequest) {
  const sharedToken = process.env.SHARED_MCP_TOKEN;
  if (sharedToken) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${sharedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null) as { question?: string; conversationId?: string } | null;
  if (!body?.question) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const conversationId = body.conversationId ?? "mcp-default";
  const response = await handleAskAgentforce({ question: body.question }, conversationId);
  return NextResponse.json({ response });
}
