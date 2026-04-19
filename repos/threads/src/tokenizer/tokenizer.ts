import type { TRect } from '../ast'
import { decodeCell, resolveColors, cellOffset } from './decode'
import { detectPalette } from './palette'
import { classifyCells } from './classify'
import { traceBorders } from './borders'
import { segmentBlocks } from './blocks'
import { extractRuns } from './runs'
import type { TToken, TCursorToken, TPalette, TCellMeta } from './types'

export type TTokenizeResult = {
  tokens: TToken[]
  cursor: TCursorToken
  palette: TPalette
  meta: TCellMeta[][]
}

export function tokenize(
  view: DataView,
  cols: number,
  rows: number,
  cursor: { x: number; y: number; visible: boolean },
  prevPalette?: TPalette,
  dirtyRows?: number[]
): TTokenizeResult {
  // Step 1: Palette detection
  // Re-run if no prevPalette, dirtyRows not provided, or >50% of rows are dirty
  let palette: TPalette
  if (!prevPalette || !dirtyRows || dirtyRows.length > rows * 0.5) {
    palette = detectPalette(view, cols, rows)
  } else {
    palette = prevPalette
  }

  // Step 2: Cell classification
  const meta = classifyCells(view, cols, rows, palette)

  // Step 3: Border tracing (full viewport)
  const fullScope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
  const frames = traceBorders(view, cols, rows, meta, fullScope)

  // Step 4: Block segmentation on root scope (excluding frame interiors)
  // Build a set of interior cell positions to exclude
  const rootBlocks = segmentBlocks(meta, fullScope, cols)

  // Fill block color from viewport data: read the cell at block.bounds.top/left
  for (const block of rootBlocks) {
    const offset = cellOffset(block.bounds.top, block.bounds.left, cols)
    const cell = decodeCell(view, offset)
    const { bg } = resolveColors(cell)
    block.color = bg
  }

  // Step 5: Run extraction on root scope (excluding frame bounds)
  const rootRuns = extractRuns(view, cols, meta, fullScope, frames)

  // Also extract runs inside each frame's interior
  const frameTokens: TToken[] = []
  for (const frame of frames) {
    // Only process frames with a valid interior (at least 1 row × 1 col interior)
    if (
      frame.interior.bottom >= frame.interior.top &&
      frame.interior.right >= frame.interior.left
    ) {
      // Find nested frames (frames whose bounds are inside this frame's interior)
      const nestedFrames = frames.filter(
        (f) =>
          f !== frame &&
          f.bounds.top >= frame.interior.top &&
          f.bounds.bottom <= frame.interior.bottom &&
          f.bounds.left >= frame.interior.left &&
          f.bounds.right <= frame.interior.right
      )

      const interiorRuns = extractRuns(view, cols, meta, frame.interior, nestedFrames)
      frameTokens.push(
        ...interiorRuns.textRuns,
        ...interiorRuns.gaps,
        ...interiorRuns.links
      )
    }
  }

  // Step 6: Cursor token
  const cursorToken: TCursorToken = {
    type: 'CursorToken',
    position: { x: cursor.x, y: cursor.y },
    visible: cursor.visible,
  }

  // Step 7: Concatenate all tokens
  const tokens: TToken[] = [
    ...frames,
    ...rootBlocks,
    ...rootRuns.textRuns,
    ...rootRuns.gaps,
    ...rootRuns.links,
    ...frameTokens,
    cursorToken,
  ]

  return { tokens, cursor: cursorToken, palette, meta }
}
