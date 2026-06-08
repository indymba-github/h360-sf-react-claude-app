import { z } from "zod";

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3001";
const SHARED_TOKEN  = process.env.SHARED_MCP_TOKEN ?? "";

export const askAgentforceSchema = z.object({
  question: z.string().min(1).describe(
    "The question or request to send to the Agentforce agent. Be specific and complete."
  ),
});

// Stable conversation ID per MCP server process — all calls within a server
// lifetime share one Agentforce session.
const MCP_CONVERSATION_ID = `mcp-${Date.now()}`;

export async function askAgentforce(input: z.infer<typeof askAgentforceSchema>): Promise<{ text: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SHARED_TOKEN) headers["Authorization"] = `Bearer ${SHARED_TOKEN}`;

  const res = await fetch(`${DASHBOARD_URL}/api/agentforce-consult`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: input.question, conversationId: MCP_CONVERSATION_ID }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { text: `Agentforce consultation failed (${res.status}): ${text}` };
  }

  const data = await res.json() as { response?: string; error?: string };
  return { text: data.response ?? data.error ?? "(No response)" };
}
