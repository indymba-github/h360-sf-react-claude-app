import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseAgentforceResponse, type AgentforceNormalizedResponse } from "@/lib/agentforce-types";

const SF_LOGIN_URL        = (process.env.SF_LOGIN_URL ?? "").replace(/\/$/, "");
const AGENT_CLIENT_ID     = process.env.SF_AGENT_CLIENT_ID    ?? "";
const AGENT_CLIENT_SECRET = process.env.SF_AGENT_CLIENT_SECRET ?? "";
const AGENT_ID            = process.env.SF_AGENT_ID            ?? "";
const AGENT_BASE_URL      = "https://api.salesforce.com";

// ── Token cache ────────────────────────────────────────────────────────────

let tokenCache:       { accessToken: string; expiresAt: number } | null = null;
let pendingTokenFetch: Promise<string> | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }
  if (pendingTokenFetch) return pendingTokenFetch;

  pendingTokenFetch = (async () => {
    const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ grant_type: "client_credentials", client_id: AGENT_CLIENT_ID, client_secret: AGENT_CLIENT_SECRET }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Token request failed (${res.status}): ${text}`);
    }
    const data = await res.json() as { access_token: string; expires_in?: number };
    tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 };
    return tokenCache.accessToken;
  })().finally(() => { pendingTokenFetch = null; });

  return pendingTokenFetch;
}

// ── Agent helpers ──────────────────────────────────────────────────────────

async function startSession(token: string): Promise<string> {
  const res = await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/agents/${AGENT_ID}/sessions`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      externalSessionKey:    crypto.randomUUID(),
      instanceConfig:        { endpoint: SF_LOGIN_URL },
      streamingCapabilities: { chunkTypes: ["Text"] },
      bypassUser:            false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to start session (${res.status}): ${text}`);
  }
  const data = await res.json() as { sessionId: string };
  return data.sessionId;
}

async function sendMessage(token: string, sessionId: string, text: string): Promise<AgentforceNormalizedResponse> {
  const res = await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}/messages`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { sequenceId: 1, type: "Text", text } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Agent message failed (${res.status}): ${body}`);
  }
  const data = await res.json();

  if (process.env.AGENTFORCE_DEBUG === "true") {
    console.log("═══ Agentforce raw response ═══");
    console.log(JSON.stringify(data, null, 2));
    console.log("Message count:", Array.isArray(data.messages) ? data.messages.length : 0);
    if (Array.isArray(data.messages)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.messages.forEach((m: any, i: number) => {
        console.log(`Message [${i}]:`, JSON.stringify(m, null, 2));
      });
    }
    console.log("═══ End Agentforce raw response ═══");
  }

  return parseAgentforceResponse(data);
}

async function endSession(token: string, sessionId: string): Promise<void> {
  await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!AGENT_CLIENT_ID || !AGENT_CLIENT_SECRET || !AGENT_ID) {
    return NextResponse.json(
      { error: "Agentforce is not configured — set SF_AGENT_ID, SF_AGENT_CLIENT_ID, SF_AGENT_CLIENT_SECRET" },
      { status: 503 },
    );
  }

  const body = await req.json();

  // Accept either a pre-composed message or the legacy promptName shape
  const message: string =
    body.message ??
    `Run the ${body.promptLabel ?? body.promptName} for ${body.accountName}`;

  if (!message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const messageWithDate = `Today is ${today}. ${message}`;

  let sessionId: string | null = null;

  try {
    const token = await getToken();
    sessionId   = await startSession(token);
    const response = await sendMessage(token, sessionId, messageWithDate);
    return NextResponse.json({
      result: response.text,
      type: response.type,
      choices: response.choices,
      results: response.results,
      summaries: response.summaries,
    });
  } catch (err: unknown) {
    console.error("[prompts/execute]", err);
    const message = err instanceof Error ? err.message : "Prompt execution failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    if (sessionId) {
      const token = await getToken().catch(() => null);
      if (token) await endSession(token, sessionId);
    }
  }
}
