/**
 * Maps render directive 'component' strings to React components.
 * Tools return component names; the registry resolves them to
 * actual implementations.
 */

import { ComponentType } from 'react'
import AccountRiskBriefing from '@/components/risk/AccountRiskBriefing'
import MortgageCalculator from '@/components/mortgage/MortgageCalculator'

const REGISTRY: Record<string, ComponentType<any>> = {
  account_risk_briefing: AccountRiskBriefing,
  mortgage_calculator: MortgageCalculator,
}

/**
 * Resolve a component name to its React component. Returns
 * null if the component is unknown (with a console warning so
 * unknown directives are debuggable).
 */
export function resolveRenderComponent(
  name: string
): ComponentType<any> | null {
  const Component = REGISTRY[name]
  if (!Component) {
    console.warn(
      `Render registry: unknown component '${name}'. ` +
      `Available: ${Object.keys(REGISTRY).join(', ')}`
    )
    return null
  }
  return Component
}

/**
 * Debugging helper — lists all known render components.
 */
export function listRenderComponents(): string[] {
  return Object.keys(REGISTRY)
}
