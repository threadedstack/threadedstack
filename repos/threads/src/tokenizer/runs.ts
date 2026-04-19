import type { TRect } from '../ast/types'
import { decodeCell, resolveColors, cellOffset } from './decode'
import type {
  TCellMeta,
  TTextRun,
  TWhitespaceGap,
  TLinkSpan,
  TRawSpan,
  TBorderFrame,
} from './types'

export type TRunResult = {
  textRuns: TTextRun[]
  gaps: TWhitespaceGap[]
  links: TLinkSpan[]
}

/**
 * Check whether a cell position is inside any child frame's bounds.
 */
function isInsideFrame(row: number, col: number, frames: TBorderFrame[]): boolean {
  for (const frame of frames) {
    if (
      row >= frame.bounds.top &&
      row <= frame.bounds.bottom &&
      col >= frame.bounds.left &&
      col <= frame.bounds.right
    ) {
      return true
    }
  }
  return false
}

/**
 * Compare two RGB-like objects for equality.
 */
function rgbEqual(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b
}

/**
 * Extract text runs, whitespace gaps, and link spans from the viewport.
 *
 * For each row in scope:
 *   - Cells inside any childFrame are skipped.
 *   - isBlank or isWideRight cells are skipped during span building.
 *   - If every non-frame cell in the row is blank, the row is treated as a gap row.
 *   - Consecutive gap rows are collapsed into a single TWhitespaceGap.
 *   - Non-gap rows produce TTextRun and/or TLinkSpan tokens.
 */
export function extractRuns(
  view: DataView,
  cols: number,
  meta: TCellMeta[][],
  scope: TRect,
  childFrames: TBorderFrame[]
): TRunResult {
  const textRuns: TTextRun[] = []
  const gaps: TWhitespaceGap[] = []
  const links: TLinkSpan[] = []

  let gapStartRow: number | null = null

  function flushGap(endRow: number) {
    if (gapStartRow === null) return
    const height = endRow - gapStartRow + 1
    gaps.push({
      type: 'WhitespaceGap',
      bounds: { top: gapStartRow, left: scope.left, bottom: endRow, right: scope.right },
      height,
    })
    gapStartRow = null
  }

  for (let row = scope.top; row <= scope.bottom; row++) {
    // Determine if this row is entirely blank (excluding frame-occupied cells)
    let rowIsBlank = true
    for (let col = scope.left; col <= scope.right; col++) {
      if (isInsideFrame(row, col, childFrames)) continue
      const cellMeta = meta[row]?.[col]
      if (!cellMeta?.isBlank) {
        rowIsBlank = false
        break
      }
    }

    if (rowIsBlank) {
      // Start or continue a gap
      if (gapStartRow === null) {
        gapStartRow = row
      }
      continue
    }

    // Non-blank row — flush any pending gap
    flushGap(row - 1)

    // Scan cells left-to-right, building TextRun spans and LinkSpans
    const spans: TRawSpan[] = []
    let runLeft = -1
    let runRight = -1

    // Track current span state
    let spanText = ''
    let spanFg = { r: 0, g: 0, b: 0 }
    let spanBg = { r: 0, g: 0, b: 0 }
    let spanFlags = 0
    let spanStartCol = -1
    let inSpan = false

    // Track current link state
    let linkText = ''
    let linkHyperlinkId = 0
    let linkLeft = -1
    let linkRight = -1
    let inLink = false

    function flushSpan(endCol: number) {
      if (!inSpan || spanText.length === 0) return
      spans.push({ text: spanText, fg: spanFg, bg: spanBg, flags: spanFlags })
      if (runLeft === -1) runLeft = spanStartCol
      runRight = endCol
      spanText = ''
      inSpan = false
    }

    function flushLink(endCol: number) {
      if (!inLink || linkText.length === 0) return
      links.push({
        type: 'LinkSpan',
        bounds: { top: row, left: linkLeft, bottom: row, right: endCol },
        hyperlinkId: linkHyperlinkId,
        text: linkText,
      })
      if (runLeft === -1) runLeft = linkLeft
      runRight = endCol
      linkText = ''
      inLink = false
    }

    for (let col = scope.left; col <= scope.right; col++) {
      if (isInsideFrame(row, col, childFrames)) {
        flushSpan(col - 1)
        flushLink(col - 1)
        continue
      }

      const cellMeta = meta[row]?.[col]
      if (!cellMeta) continue

      if (cellMeta.isWideRight) continue

      if (cellMeta.isBlank) {
        flushSpan(col - 1)
        flushLink(col - 1)
        continue
      }

      const offset = cellOffset(row, col, cols)
      const decoded = decodeCell(view, offset)
      const { fg, bg } = resolveColors(decoded)
      const ch = decoded.codepoint === 0 ? ' ' : String.fromCodePoint(decoded.codepoint)

      if (cellMeta.hasLink) {
        // Flush any active non-link span first
        flushSpan(col - 1)

        if (inLink && decoded.hyperlinkId === linkHyperlinkId) {
          // Continue same link
          linkText += ch
          linkRight = col
        } else {
          // Flush previous link if different id
          flushLink(col - 1)
          // Start new link
          inLink = true
          linkHyperlinkId = decoded.hyperlinkId
          linkLeft = col
          linkRight = col
          linkText = ch
        }
      } else {
        // Flush any active link span first
        flushLink(col - 1)

        if (inSpan) {
          // Check if style changed
          if (
            !rgbEqual(fg, spanFg) ||
            !rgbEqual(bg, spanBg) ||
            decoded.flags !== spanFlags
          ) {
            flushSpan(col - 1)
            // Start new span
            inSpan = true
            spanFg = fg
            spanBg = bg
            spanFlags = decoded.flags
            spanStartCol = col
            spanText = ch
          } else {
            spanText += ch
          }
        } else {
          // Start first span in this run
          inSpan = true
          spanFg = fg
          spanBg = bg
          spanFlags = decoded.flags
          spanStartCol = col
          spanText = ch
          if (runLeft === -1) runLeft = col
        }
      }
    }

    // Flush trailing span/link
    flushSpan(scope.right)
    flushLink(scope.right)

    // Emit TextRun if we have spans
    if (spans.length > 0 && runLeft !== -1) {
      textRuns.push({
        type: 'TextRun',
        bounds: { top: row, left: runLeft, bottom: row, right: runRight },
        spans,
      })
    }
  }

  // Flush any trailing gap
  if (gapStartRow !== null) {
    flushGap(scope.bottom)
  }

  return { textRuns, gaps, links }
}
