import type { RenderDirective } from './render-directives'

/**
 * Marker convention used by Agentforce Actions to signal render
 * directives to the frontend.
 *
 * An Action returns text containing:
 *   <<RENDER_DIRECTIVE>>{"component":"...","props":{...}}<<END_RENDER>>
 *
 * The agent reproduces this in its message. The route detects the
 * marker, extracts the JSON, and treats it as a render directive —
 * the same way Local and Hosted modes do via the MCP render tools.
 *
 * Why magic strings: Agentforce's response model paraphrases Action
 * output in natural language; the structured `result` channel only
 * surfaces for specific Action types. Magic strings travel reliably
 * through the prose layer.
 */

const MARKER_START = '<<RENDER_DIRECTIVE>>'
const MARKER_END = '<<END_RENDER>>'

export type ExtractedRender = {
  /** The render directive, if a marker was found and parsed successfully. */
  directive: RenderDirective | null
  /** The message text with the marker block removed. */
  cleanedMessage: string
}

/**
 * Scan a message for a render-directive marker. If found and the
 * embedded JSON is valid, return the directive and the message with
 * the marker stripped. If no marker is present, return null directive
 * and the message unchanged.
 */
export function extractRenderFromAgentforceMessage(
  message: string
): ExtractedRender {
  const startIdx = message.indexOf(MARKER_START)
  if (startIdx === -1) {
    return { directive: null, cleanedMessage: message }
  }

  const jsonStart = startIdx + MARKER_START.length
  const endIdx = message.indexOf(MARKER_END, jsonStart)

  if (endIdx === -1) {
    // Start marker present but no end — likely truncated response.
    // Leave the message unchanged so the user sees something.
    console.warn(
      '[agentforce-render] Found start marker but no end marker; ' +
      'leaving message unchanged'
    )
    return { directive: null, cleanedMessage: message }
  }

  const jsonText = message.substring(jsonStart, endIdx).trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    console.warn(
      '[agentforce-render] Found marker but JSON failed to parse:',
      err,
      '\nText was:', jsonText
    )
    // Strip the malformed block so the user doesn't see raw protocol text
    const cleaned = (
      message.substring(0, startIdx) +
      message.substring(endIdx + MARKER_END.length)
    ).trim()
    return { directive: null, cleanedMessage: cleaned }
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).component !== 'string' ||
    typeof (parsed as Record<string, unknown>).props !== 'object'
  ) {
    console.warn(
      '[agentforce-render] Parsed JSON does not match render directive shape:',
      parsed
    )
    const cleaned = (
      message.substring(0, startIdx) +
      message.substring(endIdx + MARKER_END.length)
    ).trim()
    return { directive: null, cleanedMessage: cleaned }
  }

  const cleaned = (
    message.substring(0, startIdx) +
    message.substring(endIdx + MARKER_END.length)
  ).trim()

  return {
    directive: parsed as RenderDirective,
    cleanedMessage: cleaned,
  }
}
