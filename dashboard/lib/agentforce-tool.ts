// dashboard/lib/agentforce-tool.ts
import type Anthropic from "@anthropic-ai/sdk";
import { getAgentClientCredentialsToken, startAgentSession, sendAgentMessage } from "./agentforce-client";

export const ASK_AGENTFORCE_TOOL: Anthropic.Tool = {
  name: "ask_agentforce",
  description: `Consult our bank's Agentforce agent for two primary capabilities that other tools CANNOT provide:

1. READING DOCUMENT CONTENT — the actual text/contents of any attached file (credit memos, loan agreements, contracts, PDFs, Notes). CRM search tools can find these documents by name or ID, but only Agentforce can read what's INSIDE them.

2. BANK-SPECIFIC POLICY AND KNOWLEDGE — internal procedures, fee schedules, customer-facing scripts, compliance rules, and institutional knowledge in Agentforce's knowledge base.

WHEN YOU MUST USE THIS TOOL:
- User asks what's INSIDE a document ("read the credit memo", "what's in the agreement", "summarize the attached PDF")
- User asks about specific clauses, terms, or details from an attached document
- User asks about our bank's policies (overdraft rules, fee schedules, dispute procedures, etc.)
- User asks anything where the answer would differ at a different bank

WHEN NOT TO USE:
- Universal concepts ("what is APR", "how does escrow work")
- Direct data queries that have dedicated tools (account balances, opportunity lists, contact info)
- Listing documents attached to an account — CRM tools handle this, no content needed

CRITICAL: Other tools may find a document and return its metadata or a link. That is NOT enough when the user asks about the content. After finding a document via CRM tools, you still need to call ask_agentforce to actually READ it. Do not stop at "here is a link to the document."

Pass account_id when an account is in scope. Each call is governed by the Einstein Trust Layer.`,
  input_schema: {
    type: "object" as const,
    properties: {
      question: {
        type: "string",
        description: "The question or request to send to the Agentforce agent. Include specific identifiers (account name, record ID, document reference, etc.) when relevant — the agent treats your message as the primary context for retrieval.",
      },
      account_id: {
        type: "string",
        description: "If the question is about a specific Salesforce Account, pass the Account Id (15- or 18-character ID starting with 001). The tool will automatically inject this as context so the agent can retrieve account-specific documents and data.",
      },
      account_name: {
        type: "string",
        description: "If the question is about a specific Salesforce Account, pass the Account Name. Helps the agent disambiguate.",
      },
    },
    required: ["question"],
  },
};

interface SessionEntry {
  sessionId: string;
  sequenceId: number;
  createdAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000;
const sessionCache = new Map<string, SessionEntry>();

async function getOrCreateSession(conversationId: string, accessToken: string, agentId: string): Promise<SessionEntry> {
  const cached = sessionCache.get(conversationId);
  if (cached && Date.now() - cached.createdAt < SESSION_TTL_MS) {
    return cached;
  }

  const sessionId = await startAgentSession(accessToken, agentId);
  const entry: SessionEntry = { sessionId, sequenceId: 0, createdAt: Date.now() };
  sessionCache.set(conversationId, entry);
  return entry;
}

export async function handleAskAgentforce(
  args: { question: string; account_id?: string; account_name?: string },
  conversationId: string,
  implicitContext?: { accountId?: string; accountName?: string },
): Promise<string> {
  // Resolution priority:
  //   1. SF_AGENT_ID (default — same agent as Agentforce mode)
  //   2. SF_AGENTFORCE_CONSULT_AGENT_ID (fallback override)
  const agentId = process.env.SF_AGENT_ID || process.env.SF_AGENTFORCE_CONSULT_AGENT_ID;

  if (!agentId) {
    return "Agentforce consultation tool is not configured. Set SF_AGENT_ID in environment.";
  }
  if (!process.env.SF_AGENT_CLIENT_ID || !process.env.SF_AGENT_CLIENT_SECRET) {
    return "Agentforce credentials not configured. Set SF_AGENT_CLIENT_ID and SF_AGENT_CLIENT_SECRET.";
  }

  // Explicit args take priority over implicit page context
  const accountId   = args.account_id   || implicitContext?.accountId;
  const accountName = args.account_name || implicitContext?.accountName;

  let composedMessage: string;
  if (accountId || accountName) {
    const contextLine = accountId && accountName
      ? `Context: User is viewing Salesforce Account "${accountName}" (Id: ${accountId}).`
      : accountId
      ? `Context: User is viewing Salesforce Account with Id ${accountId}.`
      : `Context: User is viewing Salesforce Account "${accountName}".`;
    composedMessage = `${contextLine}\n\nQuestion: ${args.question}`;
  } else {
    composedMessage = args.question;
  }

  try {
    const accessToken = await getAgentClientCredentialsToken();
    const entry = await getOrCreateSession(conversationId, accessToken, agentId);

    entry.sequenceId += 1;
    const response = await sendAgentMessage(accessToken, entry.sessionId, entry.sequenceId, composedMessage);
    return response;
  } catch (err) {
    console.error("[ask_agentforce] error:", err);
    // If the session is stale, drop it so the next call starts fresh
    sessionCache.delete(conversationId);
    return `Agentforce consultation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
