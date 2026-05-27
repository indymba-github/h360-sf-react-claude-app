/**
 * A render directive is the structured data tools return when
 * they want to render UI in the slot. The frontend reads this
 * field from tool results and looks up the component in the
 * registry.
 */

export type RenderDirective = {
  /** Identifier matching a registered component */
  component: string
  /** Props passed to the registered component */
  props: Record<string, unknown>
  /** Optional: the account this render is scoped to */
  accountId?: string
  /** Optional: a unique ID for this render — enables
      deduplication if the same tool fires twice */
  renderId?: string
}

/**
 * Type guard: detect whether a tool result includes a render
 * directive.
 */
export function hasRenderDirective(
  obj: unknown
): obj is { render: RenderDirective } {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (!o.render || typeof o.render !== 'object') return false
  const r = o.render as Record<string, unknown>
  return typeof r.component === 'string' && typeof r.props === 'object'
}

/**
 * Extract a render directive from a tool result. Returns null
 * if absent.
 */
export function extractRenderDirective(
  toolResult: unknown
): RenderDirective | null {
  if (!hasRenderDirective(toolResult)) return null
  return toolResult.render
}
