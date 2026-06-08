// dashboard/lib/agentforce-client.ts
// Shared helpers for talking to the Agentforce Agent API.
// Used by /api/agent/route.ts, /api/agentforce-consult/route.ts, and agentforce-tool.ts.

const AGENT_BASE_URL = "https://api.salesforce.com";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
let pendingTokenFetch: Promise<string> | null = null;

export async function getAgentClientCredentialsToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }
  if (pendingTokenFetch) return pendingTokenFetch;

  const loginUrl = (process.env.SF_LOGIN_URL ?? "").replace(/\/$/, "");
  const clientId = process.env.SF_AGENT_CLIENT_ID ?? "";
  const clientSecret = process.env.SF_AGENT_CLIENT_SECRET ?? "";

  pendingTokenFetch = (async () => {
    const res = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
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

export async function startAgentSession(accessToken: string, agentId: string): Promise<string> {
  const loginUrl = (process.env.SF_LOGIN_URL ?? "").replace(/\/$/, "");

  const attempt = async (bypassUser: boolean) =>
    fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/agents/${agentId}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalSessionKey: crypto.randomUUID(),
        instanceConfig: { endpoint: loginUrl },
        streamingCapabilities: { chunkTypes: ["Text"] },
        bypassUser,
      }),
    });

  let res = await attempt(false);
  if (res.status === 412 || res.status === 400) {
    res = await attempt(true);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Session start failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { sessionId: string };
  return data.sessionId;
}

export async function sendAgentMessage(
  accessToken: string,
  sessionId: string,
  sequenceId: number,
  text: string,
): Promise<string> {
  console.log("[agentforce-client] === SENDING TO AGENT ===");
  console.log("Session:", sessionId);
  console.log("Message:", text);
  console.log("[agentforce-client] === END SEND ===");

  const res = await fetch(`${AGENT_BASE_URL}/einstein/ai-agent/v1/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: { sequenceId, type: "Text", text },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Message send failed (${res.status}): ${errBody}`);
  }
  const data = await res.json() as { messages?: Array<{ type?: string; message?: string }> };

  console.log("[agentforce-client] === RAW AGENT API RESPONSE ===");
  console.log(JSON.stringify(data, null, 2));
  console.log("[agentforce-client] === END RAW RESPONSE ===");

  const messages = data.messages ?? [];
  const texts: string[] = [];
  for (const m of messages) {
    if (m.message) texts.push(m.message);
  }
  return texts.join("\n\n") || "(Agentforce returned no text response.)";
}
