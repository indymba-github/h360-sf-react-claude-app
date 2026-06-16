/**
 * Decides whether the Account Summary Agent's tool should be exposed to Claude
 * for a given user message. Uses a lightweight LLM classifier to detect summary
 * intent and whether a specific customer is named. Combined with page context
 * (is user on an account detail page?), this gates the slow aa__summarizeAccounts
 * tool so it's only offered when it's actually useful.
 */

export type SummaryRouterSignals = {
  isSummaryIntent: boolean;
  hasNamedCustomer: boolean;
  customerName: string | null;
  classifierRaw: string;
};

const SAFE_DEFAULT: SummaryRouterSignals = {
  isSummaryIntent: false,
  hasNamedCustomer: false,
  customerName: null,
  classifierRaw: "",
};

export async function classifySummaryIntent(
  userMessage: string,
  apiKey: string
): Promise<SummaryRouterSignals> {
  const classifierPrompt = `You are a routing classifier. Analyze this user message and return ONLY a JSON object with these fields:

{
  "isSummaryIntent": boolean — true if the user is asking for a summary, briefing, overview, snapshot, or holistic view of a customer/account/relationship. False for specific factual questions like "what's their phone number" or "what opportunities are open".
  "hasNamedCustomer": boolean — true if the message explicitly names a specific customer, person, account, or organization. False for pronouns ("him", "her", "this account") or generic references.
  "customerName": string or null — if hasNamedCustomer is true, the exact name as written in the message. Otherwise null.
}

Return ONLY the JSON object. No explanation, no markdown, no preamble.

User message: ${userMessage}`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: classifierPrompt }],
      }),
    });
  } catch (fetchErr) {
    console.error("[summary-router] network error:", fetchErr);
    return { ...SAFE_DEFAULT, classifierRaw: "network error" };
  }

  if (!res.ok) {
    console.error("[summary-router] classifier HTTP error:", res.status);
    return { ...SAFE_DEFAULT, classifierRaw: `error: ${res.status}` };
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";

  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      isSummaryIntent: !!parsed.isSummaryIntent,
      hasNamedCustomer: !!parsed.hasNamedCustomer,
      customerName:
        parsed.hasNamedCustomer && typeof parsed.customerName === "string"
          ? parsed.customerName.trim()
          : null,
      classifierRaw: text,
    };
  } catch {
    console.error("[summary-router] JSON parse failed:", text);
    return { ...SAFE_DEFAULT, classifierRaw: text };
  }
}

/**
 * Returns true when the Account Summary Agent tool should be included in
 * Claude's tool list.
 *
 * Rules:
 *   1. Must be summary intent (always required)
 *   2. Either user is on an account detail page OR message explicitly names a customer
 */
export function shouldExposeSummaryAgent(
  signals: SummaryRouterSignals,
  accountContext: { accountId?: string; accountName?: string } | undefined
): boolean {
  if (!signals.isSummaryIntent) return false;
  return !!accountContext?.accountId || signals.hasNamedCustomer;
}
