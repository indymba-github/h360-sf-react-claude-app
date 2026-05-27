import { NextResponse } from "next/server";

export async function GET() {
  const agentId = process.env.SF_AGENT_ID || null;
  const valid = agentId && /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(agentId);
  return NextResponse.json({ agentId: valid ? agentId : null });
}
