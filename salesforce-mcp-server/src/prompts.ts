import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

// ── Prompt definitions ──────────────────────────────────────────────────────

export const PROMPTS = [
  {
    name: "meeting_prep",
    description: "Prepare a structured meeting briefing for an account",
    arguments: [
      { name: "account_name", description: "Name of the Salesforce account", required: true },
    ],
  },
  {
    name: "account_risk_assessment",
    description: "Evaluate an account for churn and relationship health risks",
    arguments: [
      { name: "account_id", description: "Salesforce Account ID (15 or 18 characters)", required: true },
    ],
  },
  {
    name: "pipeline_review",
    description: "Walk through the full opportunity pipeline by stage",
    arguments: [],
  },
];

// ── Prompt builders ─────────────────────────────────────────────────────────

function meetingPrepPrompt(accountName: string): GetPromptResult {
  return {
    description: `Meeting prep briefing for ${accountName}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Prepare a meeting briefing for the account "${accountName}". Follow these steps:\n\n` +
            "1. Search for the account by name and retrieve its full details (industry, revenue, owner, last activity).\n" +
            "2. Fetch all open opportunities and their stages, amounts, and close dates.\n" +
            "3. Fetch open and recent cases — flag any escalated or high-priority items.\n" +
            "4. List key contacts and their roles.\n" +
            "5. Identify risks: deals past close date, no activity in 30+ days, open escalated cases, missing decision-maker contact.\n" +
            "6. Suggest one follow-up action and offer to create a prep task.\n\n" +
            "Format the output as a concise briefing with sections: Account Snapshot, Pipeline, Open Cases, Key Contacts, Risks & Flags, Recommended Action.",
        },
      },
    ],
  };
}

function accountRiskAssessmentPrompt(accountId: string): GetPromptResult {
  return {
    description: "Account risk assessment",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Run a risk assessment for account ID "${accountId}". Evaluate each dimension:\n\n` +
            "**Engagement risk** — Fetch the account's LastActivityDate. Flag as HIGH if > 30 days ago, MEDIUM if 15–30 days.\n" +
            "**Pipeline risk** — Fetch open opportunities. Flag any where CloseDate is in the past or within 7 days and stage is not Closed Won/Lost.\n" +
            "**Support risk** — Fetch open cases. Flag as HIGH if any are Priority = High or Status = Escalated.\n" +
            "**Contact coverage** — Fetch contacts. Flag if there are fewer than 2 contacts or no contact with a decision-maker title (VP, Director, C-level).\n\n" +
            "Score each dimension: 🔴 High / 🟡 Medium / 🟢 Low.\n" +
            "Conclude with an overall risk rating and the single most important recommended action.",
        },
      },
    ],
  };
}

function pipelineReviewPrompt(): GetPromptResult {
  return {
    description: "Pipeline review across all open opportunities",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            "Run a full pipeline review. Follow these steps:\n\n" +
            "1. Call sf_get_pipeline_summary to get stage-by-stage totals and win-rate data.\n" +
            "2. Call sf_get_opportunities (no filters, limit 50) to get deal-level detail.\n" +
            "3. Summarize: total pipeline value, count by stage, average deal size.\n" +
            "4. Identify the 3 largest open deals by amount — include account name, stage, close date, and owner.\n" +
            "5. Flag deals where CloseDate has passed and the opportunity is still open.\n" +
            "6. Flag any stage that has 0 deals — gaps in the funnel.\n" +
            "7. Compare Closed Won vs Closed Lost count and value for this quarter if data is available.\n\n" +
            "Format as: Pipeline Summary, Top Deals, Overdue Deals, Funnel Gaps, Win/Loss Snapshot.",
        },
      },
    ],
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export function getPrompt(name: string, args: Record<string, string> = {}): GetPromptResult {
  switch (name) {
    case "meeting_prep": {
      const accountName = args["account_name"]?.trim();
      if (!accountName) throw new Error("account_name is required");
      return meetingPrepPrompt(accountName);
    }
    case "account_risk_assessment": {
      const accountId = args["account_id"]?.trim();
      if (!accountId) throw new Error("account_id is required");
      return accountRiskAssessmentPrompt(accountId);
    }
    case "pipeline_review":
      return pipelineReviewPrompt();
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
