import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getFinancialAccountBalance } from "@/lib/salesforce";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const balance = await getFinancialAccountBalance(session.instanceUrl, session.accessToken, id);
  return NextResponse.json({ balance });
}
