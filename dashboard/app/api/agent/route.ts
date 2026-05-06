import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const SF_LOGIN_URL         = (process.env.SF_LOGIN_URL ?? "").replace(/\/$/, "");
const AGENT_CLIENT_ID      = process.env.SF_AGENT_CLIENT_ID ?? "";
const AGENT_CLIENT_SECRET  = process.env.SF_AGENT_CLIENT_SECRET ?? "";
const AGENT_ID             = process.env.SF_AGENT_ID ?? "";

// All Agent API calls go to the global gateway, not the org's My Domain URL.
const AGENT_BASE_URL = "https://api.salesforce.com";

// ── Token cache (in-process, cleared on cold start) ───────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms epoch
}

let tokenCache: TokenCache | null = null;
// Pending promise deduplicates concurrent token fetches so only one request goes to SF.
let pendingTokenFetch: Promise<string> | null = null;

async function getClientCredentialsToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  if (pendingTokenFetch) return pendingTokenFetch;

  pendingTokenFetch = (async () => {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AGENT_CLIENT_ID,
      client_secret: AGENT_CLIENT_SECRET,
    });

    const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Token request failed (${res.status}): ${text}`);
    }

    const data = await res.json() as { access_token: string; expires_in?: number };

    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };

    return tokenCache.accessToken;
  })().finally(() => { pendingTokenFetch = null; });

  return pendingTokenFetch;
}

// ── Agent session helpers ─────────────────────────────────────────────────────

async function startSession(accessToken: string): Promise<string> {
  const res = await fetch(
    `${AGENT_BASE_URL}/einstein/ai-agent/v1/agents/${AGENT_ID}/sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalSessionKey: crypto.randomUUID(),
        instanceConfig: { endpoint: SF_LOGIN_URL },
        streamingCapabilities: { chunkTypes: ["Text"] },
        bypassUser: false,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to start agent session (${res.status}): ${text}`);
  }

  const data = await res.json() as { sessionId: string };
  return data.sessionId;
}

async function sendMessage(
  accessToken: string,
  sessionId: string,
  sequenceId: number,
  text: string,
): Promise<string> {
  const res = await fetch(
    `${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          sequenceId,
          type: "Text",
          text,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent message failed (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    messages?: Array<{ type?: string; message?: string }>;
  };

  // Validated shape: { messages: [{ type: "Inform", message: "text" }] }
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    return data.messages[0].message ?? "";
  }
  return JSON.stringify(data);
}

async function endSession(accessToken: string, sessionId: string): Promise<void> {
  await fetch(
    `${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(() => {});
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    action: "message" | "end";
    text?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  if (!AGENT_CLIENT_ID || !AGENT_CLIENT_SECRET || !AGENT_ID) {
    return NextResponse.json(
      { error: "Agentforce is not configured — set SF_AGENT_ID, SF_AGENT_CLIENT_ID, SF_AGENT_CLIENT_SECRET" },
      { status: 503 }
    );
  }

  // ── End session ───────────────────────────────────────────────────────────
  if (body.action === "end") {
    if (session.agentSessionId) {
      try {
        const accessToken = await getClientCredentialsToken();
        await endSession(accessToken, session.agentSessionId);
      } catch {
        // best-effort cleanup; ignore errors
      }
      session.agentSessionId  = undefined;
      session.agentSequenceId = undefined;
      await session.save();
    }
    return NextResponse.json({ ok: true });
  }

  // ── Send message ──────────────────────────────────────────────────────────
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const attempt = async (freshToken = false): Promise<NextResponse> => {
    if (freshToken) tokenCache = null;

    const accessToken = await getClientCredentialsToken();

    // Start a new session if we don't have one
    if (!session.agentSessionId) {
      session.agentSessionId  = await startSession(accessToken);
      session.agentSequenceId = 0;
    }

    const sequenceId = (session.agentSequenceId ?? 0) + 1;

    try {
      const reply = await sendMessage(accessToken, session.agentSessionId, sequenceId, body.text!.trim());
      session.agentSequenceId = sequenceId;
      await session.save();
      return NextResponse.json({ reply });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Session not found — start a fresh session and retry once
      if ((msg.includes("404") || msg.includes("SESSION_NOT_FOUND")) && !freshToken) {
        session.agentSessionId  = undefined;
        session.agentSequenceId = undefined;
        return attempt(true);
      }

      // Token expired — clear cache, start fresh session, retry once
      if ((msg.includes("401") || msg.includes("INVALID_SESSION_ID")) && !freshToken) {
        session.agentSessionId  = undefined;
        session.agentSequenceId = undefined;
        return attempt(true);
      }

      throw err;
    }
  };

  try {
    return await attempt();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agentforce request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
