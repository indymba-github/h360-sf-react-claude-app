import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { extractBrand } from "@/lib/brand-extractor";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { url?: string } | null;
  const url = body?.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await extractBrand(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Brand extraction failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
