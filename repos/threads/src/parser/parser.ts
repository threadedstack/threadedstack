import type { TDocument, TContentNode } from '../ast'
import type { TTokenizeResult } from '../tokenizer'
import { detectMode } from './modeDetector'
import type { TModeContext } from './modeDetector'
import { parseScopes } from './scopeParser'
import { parseFlatContent } from './flatParser'

/**
 * Top-level parser orchestrator.
 *
 * Takes the raw tokenizer result and mode context, then:
 * 1. Detects the viewport mode
 * 2. Parses scoped (framed) content into panels
 * 3. Parses remaining flat content
 * 4. Returns a TDocument AST root
 */
export function parse(tokenResult: TTokenizeResult, modeCtx: TModeContext): TDocument {
  const mode = detectMode(modeCtx)

  const cursor = {
    x: tokenResult.cursor.position.x,
    y: tokenResult.cursor.position.y,
    visible: tokenResult.cursor.visible,
  }

  // Derive root bounds from all tokens or fall back to a default
  const rootBounds = deriveRootBounds(tokenResult)

  // Parse scoped content (border frames -> panels)
  const { panels, remaining } = parseScopes(tokenResult.tokens, rootBounds, cursor)

  // Parse remaining flat content
  const flatNodes = parseFlatContent(remaining, rootBounds, cursor)

  const children: TContentNode[] = [...panels, ...flatNodes]

  return {
    type: 'Document',
    bounds: rootBounds,
    cursor,
    mode,
    children,
  }
}

/**
 * Derive the root viewport bounds from the token result.
 * Uses the union of all token bounds, falling back to 0,0 - 24,79.
 */
function deriveRootBounds(tokenResult: TTokenizeResult): {
  top: number
  left: number
  bottom: number
  right: number
} {
  let top = Number.MAX_SAFE_INTEGER
  let left = Number.MAX_SAFE_INTEGER
  let bottom = 0
  let right = 0
  let found = false

  for (const token of tokenResult.tokens) {
    if ('bounds' in token) {
      const b = token.bounds
      if (b.top < top) top = b.top
      if (b.left < left) left = b.left
      if (b.bottom > bottom) bottom = b.bottom
      if (b.right > right) right = b.right
      found = true
    }
  }

  if (!found) {
    return { top: 0, left: 0, bottom: 23, right: 79 }
  }

  return { top, left, bottom, right }
}
