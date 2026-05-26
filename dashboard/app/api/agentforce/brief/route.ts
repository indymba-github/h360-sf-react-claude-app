import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseAgentforceResponse, type AgentforceNormalizedResponse } from "@/lib/agentforce-types";

// ── Env ───────────────────────────────────────────────────────────────────────

const SF_LOGIN_URL        = (process.env.SF_LOGIN_URL ?? "").replace(/\/$/, "");
const AGENT_CLIENT_ID     = process.env.SF_AGENT_CLIENT_ID ?? "";
const AGENT_CLIENT_SECRET = process.env.SF_AGENT_CLIENT_SECRET ?? "";
const AGENT_ID            = process.env.SF_AGENT_ID ?? "";
const AGENT_BASE_URL      = "https://api.salesforce.com";

// ── Token cache ───────────────────────────────────────────────────────────────

let tokenCache: { accessToken: string; expiresAt: number } | null = null;
let pendingToken: Promise<string> | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.accessToken;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: AGENT_CLIENT_ID,
        client_secret: AGENT_CLIENT_SECRET,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text().catch(() => "")}`);
    const d = await res.json() as { access_token: string; expires_in?: number };
    tokenCache = { accessToken: d.access_token, expiresAt: Date.now() + (d.expires_in ?? 7200) * 1000 };
    return tokenCache.accessToken;
  })().finally(() => { pendingToken = null; });
  return pendingToken;
}

// ── Agent helpers ─────────────────────────────────────────────────────────────

async function startSession(token: string): Promise<string> {
  const res = await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/agents/${AGENT_ID}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      externalSessionKey: crypto.randomUUID(),
      instanceConfig: { endpoint: SF_LOGIN_URL },
      streamingCapabilities: { chunkTypes: ["Text"] },
      bypassUser: false,
    }),
  });
  if (!res.ok) throw new Error(`Session start failed (${res.status}): ${await res.text().catch(() => "")}`);
  return ((await res.json()) as { sessionId: string }).sessionId;
}

async function ask(token: string, sessionId: string, text: string): Promise<AgentforceNormalizedResponse> {
  const res = await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { sequenceId: 1, type: "Text", text } }),
  });
  if (!res.ok) throw new Error(`Agent message failed (${res.status}): ${await res.text().catch(() => "")}`);
  const d = await res.json();

  if (process.env.AGENTFORCE_DEBUG === "true") {
    console.log("═══ Agentforce raw response ═══");
    console.log(JSON.stringify(d, null, 2));
    console.log("Message count:", Array.isArray(d.messages) ? d.messages.length : 0);
    if (Array.isArray(d.messages)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d.messages.forEach((m: any, i: number) => {
        console.log(`Message [${i}]:`, JSON.stringify(m, null, 2));
      });
    }
    console.log("═══ End Agentforce raw response ═══");
  }

  return parseAgentforceResponse(d);
}

async function closeSession(token: string, sessionId: string): Promise<void> {
  await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ── Chip types & messages ─────────────────────────────────────────────────────

type ChipType = "executive_brief" | "financial_summary" | "activity_summary" | "cross_sell_ideas";

const CHIP_LOADING_VERB: Record<ChipType, string> = {
  executive_brief:   "Drafting your executive brief",
  financial_summary: "Summarizing financials",
  activity_summary:  "Looking back at recent activity",
  cross_sell_ideas:  "Searching for cross-sell opportunities",
};

// Mirror the same short natural-language format the AI Assistant uses —
// Agentforce looks up the data itself via its own Salesforce tools.
function buildMessage(chipType: ChipType, accountName: string, accountId: string): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const prefix = `Today is ${today}. The user is viewing the account record for ${accountName} (Account ID: ${accountId}).`;

  const request: Record<ChipType, string> = {
    executive_brief:   `Create an executive briefing for ${accountName}.`,
    financial_summary: `Summarize the financial accounts for ${accountName}.`,
    activity_summary:  `Summarize recent activity for ${accountName}.`,
    cross_sell_ideas:  `What cross-sell or upsell opportunities exist for ${accountName}?`,
  };

  return `${prefix}\n\n${request[chipType]}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!AGENT_CLIENT_ID || !AGENT_CLIENT_SECRET || !AGENT_ID) {
    return NextResponse.json(
      { error: "Agentforce is not configured — set SF_AGENT_ID, SF_AGENT_CLIENT_ID, SF_AGENT_CLIENT_SECRET", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null) as {
    accountId?: string;
    accountName?: string;
    chipType?: string;
  } | null;

  if (!body?.accountId || !body?.accountName || !body?.chipType) {
    return NextResponse.json({ error: "accountId, accountName, and chipType are required" }, { status: 400 });
  }

  const validChips: ChipType[] = ["executive_brief", "financial_summary", "activity_summary", "cross_sell_ideas"];
  if (!validChips.includes(body.chipType as ChipType)) {
    return NextResponse.json({ error: "Invalid chipType" }, { status: 400 });
  }

  const chipType = body.chipType as ChipType;
  const message  = buildMessage(chipType, body.accountName, body.accountId);

  try {
    const token   = await getToken();
    const sid     = await startSession(token);
    try {
      const response = await ask(token, sid, message);
      return NextResponse.json({
        content: response.text,
        type: response.type,
        choices: response.choices,
        results: response.results,
        summaries: response.summaries,
      });
    } finally {
      closeSession(token, sid);
    }
  } catch (err) {
    const msg    = err instanceof Error ? err.message : "Agentforce request failed";
    const isAuth = msg.includes("401") || msg.includes("INVALID_SESSION");
    return NextResponse.json({ error: msg }, { status: isAuth ? 401 : 500 });
  }
}
