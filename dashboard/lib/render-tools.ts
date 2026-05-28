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
