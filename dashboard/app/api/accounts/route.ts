import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listAccounts } from "@/lib/salesforce";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  try {
    const accounts = await listAccounts(session.instanceUrl, session.accessToken, 50, offset);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "SF_SESSION_EXPIRED") {
      return NextResponse.json({ error: "SF_SESSION_EXPIRED" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
