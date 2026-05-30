/**
 * Route-level render tools. Injected into the tool list sent to
 * Claude in EVERY provider mode (local and hosted). Handled
 * entirely in-route — no MCP server call is made.
 *
 * Render tools are experience-layer: they produce UI (render
 * directives), not data. That's why they live here, not in any
 * MCP server.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { RenderDirective } from './render-directives'

export const RENDER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'render_mortgage_calculator',
    description:
      'Render an interactive mortgage payment calculator. Use ' +
      'when the user asks to calculate, estimate, or compute a ' +
      'mortgage payment, or asks hypothetical questions about ' +
      'mortgage scenarios (e.g., "what would a $400K home at 7% ' +
      'cost?"). The calculator opens as an overlay with the ' +
      'provided values pre-populated; the user can adjust any ' +
      'input and results update in real-time. Extract values ' +
      'from the user message if provided; omit any not specified ' +
      '(the calculator applies sensible defaults).',
    input_schema: {
      type: 'object',
      properties: {
        homePrice: { type: 'number', description: 'Total home/property price in USD' },
        downPaymentAmount: { type: 'number', description: 'Down payment dollar amount in USD' },
        downPaymentPercent: { type: 'number', description: 'Down payment as a percentage (e.g., 20 for 20%)' },
        interestRate: { type: 'number', description: 'Annual interest rate as percentage (e.g., 7.0)' },
        loanTermYears: { type: 'number', description: 'Loan term in years (typically 15 or 30)' },
        annualPropertyTax: { type: 'number', description: 'Annual property tax in USD' },
        annualHomeInsurance: { type: 'number', description: 'Annual home insurance in USD' },
        monthlyHOA: { type: 'number', description: 'Monthly HOA fees in USD' },
      },
      required: [],
    },
  },
  {
    name: 'render_account_risk_briefing',
    description:
      'Render an interactive Account Risk Briefing card as an ' +
      'overlay on the user screen. You MUST first gather the ' +
      'account data using available tools (activities, ' +
      'opportunities, contacts) and apply the bank risk ' +
      'heuristics (see the system prompt) to compute severity ' +
      'and contributing factors for both Engagement Risk and ' +
      'Pipeline Risk. Then call this tool with the structured ' +
      'assessment. Do not call this tool without first ' +
      'computing the assessment. The render tool does not fetch ' +
      'data — it only renders what you provide.',
    input_schema: {
      type: 'object',
      properties: {
        accountId: {
          type: 'string',
          description: 'Salesforce Account Id (for the card scope and follow-up questions)',
        },
        accountName: {
          type: 'string',
          description: 'Account name to display in the briefing header',
        },
        engagementRisk: {
          type: 'object',
          description: 'Engagement risk assessment computed per the bank heuristics',
          properties: {
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'unknown'],
              description: 'Computed severity from the engagement signal roll-up',
            },
            summary: {
              type: 'string',
              description: 'One sentence natural language summary you write to interpret the severity',
            },
            metrics: {
              type: 'array',
              description: 'Three metric cards: Days Since Touch, Activities (90d), Contacts',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['label', 'value'],
              },
            },
            factors: {
              type: 'array',
              description: 'Contributing factors for the severity (only for signals that fired Medium or High). Omit or empty if severity is low.',
              items: { type: 'string' },
            },
            emptyState: {
              type: 'boolean',
              description: 'True if the account has insufficient data to assess engagement. Set severity to unknown when true.',
            },
          },
          required: ['severity', 'summary'],
        },
        pipelineRisk: {
          type: 'object',
          description: 'Pipeline risk assessment computed per the bank heuristics',
          properties: {
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'unknown'],
            },
            summary: { type: 'string' },
            metrics: {
              type: 'array',
              description: 'Three metric cards: Open Opps, Stalled, Closed Lost (180d)',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['label', 'value'],
              },
            },
            factors: {
              type: 'array',
              items: { type: 'string' },
            },
            emptyState: { type: 'boolean' },
          },
          required: ['severity', 'summary'],
        },
      },
      required: ['accountName', 'engagementRisk', 'pipelineRisk'],
    },
  },
]

/** Fast membership check — is this tool name a route-level render tool? */
export const RENDER_TOOL_NAMES = new Set(RENDER_TOOLS.map((t) => t.name))

export type RenderToolResult = {
  text: string
  render: RenderDirective
}

/**
 * Handle a render tool call in-route. Returns text + a render
 * directive. Does NOT call any MCP server.
 */
export function handleRenderTool(
  name: string,
  input: Record<string, unknown>,
  accountId?: string
): RenderToolResult | null {
  switch (name) {
    case 'render_mortgage_calculator':
      return handleMortgageCalculator(input, accountId)
    case 'render_account_risk_briefing':
      return handleAccountRiskBriefing(input, accountId)
    default:
      return null
  }
}

function handleMortgageCalculator(
  input: Record<string, unknown>,
  accountId?: string
): RenderToolResult {
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' ? v : undefined

  const props = {
    homePrice: num(input.homePrice),
    downPaymentAmount: num(input.downPaymentAmount),
    downPaymentPercent: num(input.downPaymentPercent),
    interestRate: num(input.interestRate),
    loanTermYears: num(input.loanTermYears),
    annualPropertyTax: num(input.annualPropertyTax),
    annualHomeInsurance: num(input.annualHomeInsurance),
    monthlyHOA: num(input.monthlyHOA),
  }

  const render: RenderDirective = {
    component: 'mortgage_calculator',
    accountId,
    props,
  }

  const parts: string[] = []
  if (props.homePrice) parts.push(`home price $${props.homePrice.toLocaleString()}`)
  if (props.downPaymentAmount) parts.push(`down payment $${props.downPaymentAmount.toLocaleString()}`)
  else if (props.downPaymentPercent) parts.push(`${props.downPaymentPercent}% down`)
  if (props.interestRate) parts.push(`rate ${props.interestRate}%`)
  if (props.loanTermYears) parts.push(`${props.loanTermYears}-year term`)

  const text =
    parts.length > 0
      ? `Opened mortgage calculator with: ${parts.join(', ')}. The user can adjust any value to see the updated payment.`
      : `Opened mortgage calculator with default values. The user can enter loan details to see the monthly payment.`

  return { text, render }
}

function handleAccountRiskBriefing(
  input: Record<string, unknown>,
  accountId?: string
): RenderToolResult {
  const accountName = String(input.accountName ?? 'Account')
  const engagementRisk = input.engagementRisk as Record<string, unknown>
  const pipelineRisk = input.pipelineRisk as Record<string, unknown>

  const render: RenderDirective = {
    component: 'account_risk_briefing',
    accountId: accountId ?? (input.accountId as string | undefined),
    props: {
      accountName,
      engagementRisk,
      pipelineRisk,
    },
  }

  const eSev = String(engagementRisk?.severity ?? 'unknown')
  const pSev = String(pipelineRisk?.severity ?? 'unknown')
  const text =
    `Rendered risk briefing for ${accountName}. ` +
    `Engagement risk: ${eSev}. Pipeline risk: ${pSev}.`

  return { text, render }
}
