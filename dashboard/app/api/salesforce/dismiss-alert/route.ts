import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SF_API_VERSION } from "@/lib/salesforce";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { taskId } = await req.json();

  if (!taskId || typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const url = `${session.instanceUrl}/services/data/${SF_API_VERSION}/sobjects/Task/${encodeURIComponent(taskId)}`;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Status: "Completed" }),
    });

    if (res.status === 204) {
      return NextResponse.json({ ok: true });
    }

    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data)
      ? data.map((e: { message?: string; errorCode?: string }) => e.message ?? e.errorCode).join("; ")
      : (data?.message ?? `Salesforce error ${res.status}`);

    return NextResponse.json({ error: message }, { status: res.status });

  } catch (err: unknown) {
    console.error("[dismiss-alert]", err);
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
