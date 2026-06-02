import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTransactionsForFinancialAccount } from "@/lib/salesforce";

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

  try {
    const transactions = await getTransactionsForFinancialAccount(
      session.instanceUrl,
      session.accessToken,
      id,
      25
    );
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("[fa-transactions]", err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
