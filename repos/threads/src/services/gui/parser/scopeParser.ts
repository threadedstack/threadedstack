import type { TRect, TPanel, TToken, TBorderFrame, TContentNode } from '@TTH/types'

import { parseFlatContent } from '@TTH/services/gui/parser/flatParser'

/**
 * Compute the area of a TRect in cells.
 */
function rectArea(r: TRect): number {
  return (r.bottom - r.top + 1) * (r.right - r.left + 1)
}

/**
 * Check if rect `inner` is fully contained within rect `outer`.
 */
function isInside(inner: TRect, outer: TRect): boolean {
  return (
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom &&
    inner.left >= outer.left &&
    inner.right <= outer.right
  )
}

/**
 * Check if a token's bounds overlap with or are inside a TRect.
 */
function tokenInsideRect(token: { bounds: TRect }, rect: TRect): boolean {
  return (
    token.bounds.top >= rect.top &&
    token.bounds.bottom <= rect.bottom &&
    token.bounds.left >= rect.left &&
    token.bounds.right <= rect.right
  )
}

/**
 * Parse scoped content: identify TBorderFrame tokens, build TPanel AST
 * nodes for top-level frames, and recursively parse nested frames.
 *
 * Returns panels plus any tokens that fall outside all frames.
 */
export function parseScopes(
  tokens: TToken[],
  rootBounds: TRect,
  cursor: { x: number; y: number; visible: boolean }
): { panels: TPanel[]; remaining: TToken[] } {
  // Step 1: Separate border frames from other tokens
  const frames: TBorderFrame[] = []
  const otherTokens: TToken[] = []

  for (const t of tokens) {
    if (t.type === `BorderFrame`) {
      frames.push(t)
    } else {
      otherTokens.push(t)
    }
  }

  if (frames.length === 0) {
    return { panels: [], remaining: otherTokens }
  }

  // Step 2: Sort frames by area (largest first) for nesting detection
  const sortedFrames = [...frames].sort((a, b) => rectArea(b.bounds) - rectArea(a.bounds))

  // Step 3: Identify which frames are nested inside other frames' interiors
  const nestedSet = new Set<TBorderFrame>()
  for (let i = 0; i < sortedFrames.length; i++) {
    for (let j = i + 1; j < sortedFrames.length; j++) {
      if (isInside(sortedFrames[j].bounds, sortedFrames[i].interior)) {
        nestedSet.add(sortedFrames[j])
      }
    }
  }

  // Step 4: Process top-level frames only
  const topLevelFrames = sortedFrames.filter((f) => !nestedSet.has(f))
  const panels: TPanel[] = []

  // Track which tokens are consumed by frames
  const consumedTokens = new Set<TToken>()

  for (const frame of topLevelFrames) {
    // Collect tokens inside the frame's interior
    const interiorTokens: TToken[] = []
    for (const t of otherTokens) {
      if (`bounds` in t && tokenInsideRect(t as { bounds: TRect }, frame.interior)) {
        interiorTokens.push(t)
        consumedTokens.add(t)
      }
    }

    // Also include nested frames as tokens for recursive processing
    for (const nf of sortedFrames) {
      if (nestedSet.has(nf) && isInside(nf.bounds, frame.interior)) {
        interiorTokens.push(nf)
        consumedTokens.add(nf)
      }
    }

    // Recursively parse interior tokens
    const { panels: childPanels, remaining: interiorRemaining } = parseScopes(
      interiorTokens,
      frame.interior,
      cursor
    )

    // Parse remaining interior tokens as flat content
    const flatNodes = parseFlatContent(interiorRemaining, frame.interior, cursor)

    const children: TContentNode[] = [...childPanels, ...flatNodes]

    const panelNode: TPanel = {
      type: `Panel`,
      bounds: frame.bounds,
      border: frame.style,
      children,
      ...(frame.title !== undefined ? { title: frame.title } : {}),
    }

    panels.push(panelNode)
  }

  // Step 5: Collect remaining tokens (outside all frames)
  const remaining = otherTokens.filter((t) => !consumedTokens.has(t))

  return { panels, remaining }
}
