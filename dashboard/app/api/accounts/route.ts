import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { queryAccounts, type AccountSortBy } from "@/lib/salesforce";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const sortBy = (params.get("sortBy") ?? "name-asc") as AccountSortBy;
  const offset = Math.max(0, parseInt(params.get("offset") ?? "0", 10));

  try {
    const result = await queryAccounts(session.instanceUrl, session.accessToken, {
      pageSize: 200,
      search: params.get("search") || undefined,
      industry: params.get("industry") || undefined,
      sortBy,
      afterName: params.get("afterName") || undefined,
      offset: sortBy !== "name-asc" ? offset : 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "SF_SESSION_EXPIRED") {
      return NextResponse.json({ error: "SF_SESSION_EXPIRED" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
