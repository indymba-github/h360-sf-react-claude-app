import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.redirect(new URL("/", process.env.SF_CALLBACK_URL!.replace("/api/auth/callback", "")));
}

// Support GET so a plain link can trigger logout
export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.redirect(new URL("/", process.env.SF_CALLBACK_URL!.replace("/api/auth/callback", "")));
}
