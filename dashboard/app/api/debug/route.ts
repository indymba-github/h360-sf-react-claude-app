import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    accessToken: session?.accessToken || null,
    instanceUrl: session?.instanceUrl || null,
    mcpAccessToken: session?.mcpAccessToken || null,
  });
}
