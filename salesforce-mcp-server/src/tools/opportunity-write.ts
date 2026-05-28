import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { sfCreate, query } from "../salesforce.js";
import type { SFQueryRecord } from "../salesforce.js";

export const createMortgageOpportunityTool: Tool = {
  name: "create_mortgage_opportunity",
  description:
    "Create a Salesforce Opportunity from a mortgage calculator " +
    "scenario. This is a WRITE operation that creates a real " +
    "record. ALWAYS describe the proposed opportunity to the " +
    "user and get explicit confirmation BEFORE calling this " +
    "tool. The opportunity's Amount is set to the loan principal; " +
    "the full mortgage scenario is stored in the Description. " +
    "Requires an accountId — if you don't have one, ask the user " +
    "which account this opportunity belongs to before calling.",
  inputSchema: {
    type: "object",
    properties: {
      accountId: {
        type: "string",
        description: "Salesforce Account Id to attach the opportunity to (required)",
      },
      loanAmount: {
        type: "number",
        description: "Loan principal — becomes the Opportunity Amount",
      },
      homePrice: {
        type: "number",
        description: "Home price from the calculator scenario",
      },
      downPaymentAmount: {
        type: "number",
        description: "Down payment dollar amount",
      },
      downPaymentPercent: {
        type: "number",
        description: "Down payment percentage",
      },
      interestRate: {
        type: "number",
        description: "Annual interest rate percentage",
      },
      loanTermYears: {
        type: "number",
        description: "Loan term in years",
      },
      monthlyPayment: {
        type: "number",
        description: "Total monthly payment (PITI) from the calculator",
      },
      opportunityName: {
        type: "string",
        description: "Optional custom name. If omitted, a name is auto-generated.",
      },
    },
    required: ["accountId", "loanAmount"],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function executeCreateMortgageOpportunity(args: {
  accountId: string;
  loanAmount: number;
  homePrice?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  loanTermYears?: number;
  monthlyPayment?: number;
  opportunityName?: string;
}) {
  // Fetch account name for the auto-generated opportunity name
  let accountName = "Account";
  try {
    type AccountRecord = SFQueryRecord & { Name: string };
    const records = await query<AccountRecord>(
      `SELECT Name FROM Account WHERE Id = '${args.accountId}' LIMIT 1`
    );
    accountName = records[0]?.Name || "Account";
  } catch {
    // Fall back to generic name if lookup fails
  }

  // Auto-generate name if not provided
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const name = args.opportunityName || `Mortgage — ${accountName} — ${dateStr}`;

  // CloseDate = today + 30 days, formatted YYYY-MM-DD
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 30);
  const closeDateStr = closeDate.toISOString().split("T")[0];

  // Build a readable scenario description
  const fmt = (n?: number) =>
    n !== undefined ? `$${n.toLocaleString()}` : "N/A";

  const description =
    `Mortgage scenario generated from the payment calculator.\n\n` +
    `Home Price: ${fmt(args.homePrice)}\n` +
    `Down Payment: ${fmt(args.downPaymentAmount)}` +
    (args.downPaymentPercent !== undefined
      ? ` (${args.downPaymentPercent.toFixed(1)}%)`
      : "") +
    `\n` +
    `Loan Amount: ${fmt(args.loanAmount)}\n` +
    `Interest Rate: ${args.interestRate !== undefined ? args.interestRate + "%" : "N/A"}\n` +
    `Loan Term: ${args.loanTermYears !== undefined ? args.loanTermYears + " years" : "N/A"}\n` +
    `Estimated Monthly Payment: ${fmt(args.monthlyPayment)}`;

  try {
    const { id, instanceUrl } = await sfCreate("Opportunity", {
      Name: name,
      AccountId: args.accountId,
      StageName: "Prospecting",
      CloseDate: closeDateStr,
      Amount: args.loanAmount,
      Type: "Simple Opportunity",
      Description: description,
    });

    const recordUrl = `${instanceUrl}/lightning/r/Opportunity/${id}/view`;

    return {
      content: [
        {
          type: "text" as const,
          text:
            `Created opportunity "${name}" (Id: ${id}) on ${accountName}. ` +
            `Amount: ${fmt(args.loanAmount)}, Stage: Prospecting, ` +
            `Close Date: ${closeDateStr}. ` +
            `The full mortgage scenario is saved in the opportunity description. ` +
            `View the record here: [View Opportunity in Salesforce](${recordUrl})`,
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Error creating opportunity: ${message}. ` +
            `This may be due to a required field or validation rule in the org.`,
        },
      ],
    };
  }
}
