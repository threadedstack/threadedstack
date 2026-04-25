import type { TRect } from '@TTH/types/ast.types'
import { cellOffset, decodeCell } from './decode'
import type { TCellMeta, TBorderFrame } from '@TTH/types/tokenizer.types'

// --- Top-left corners ---
const TOP_LEFT_CORNERS = new Set([
  0x250c, // ┌ single
  0x2554, // ╔ double
  0x250f, // ┏ heavy
  0x256d, // ╭ rounded
])

// --- Top-right corners ---
const TOP_RIGHT_CORNERS = new Set([
  0x2510, // ┐ single
  0x2557, // ╗ double
  0x2513, // ┓ heavy
  0x256e, // ╮ rounded
])

// --- Bottom-right corners ---
const BOTTOM_RIGHT_CORNERS = new Set([
  0x2518, // ┘ single
  0x255d, // ╝ double
  0x251b, // ┛ heavy
  0x256f, // ╯ rounded
])

// --- Bottom-left corners ---
const BOTTOM_LEFT_CORNERS = new Set([
  0x2514, // └ single
  0x255a, // ╚ double
  0x2517, // ┗ heavy
  0x2570, // ╰ rounded
])

// --- Horizontal connectors (top/bottom borders) ---
const HORIZONTAL_CONNECTORS = new Set([
  0x2500, // ─
  0x2550, // ═
  0x2501, // ━
  0x252c, // ┬
  0x2534, // ┴
  0x2564, // ╤
  0x2567, // ╧
  0x2566, // ╦
  0x2569, // ╩
  0x2533, // ┳
  0x253b, // ┻
  0x2510, // ┐ (also a corner, but can appear mid-border in rare layouts)
  0x2514, // └
])

// A codepoint counts as a "passthrough" on the top border if it is a
// horizontal connector, a top-right corner, OR any non-empty non-box-draw
// character (title text).
function isHorizontalPassthrough(cp: number, isBoxDraw: boolean): boolean {
  if (TOP_RIGHT_CORNERS.has(cp)) return true
  if (HORIZONTAL_CONNECTORS.has(cp)) return true
  // Allow non-box-draw text (title characters)
  if (!isBoxDraw && cp !== 0 && cp !== 0x20) return true
  return false
}

// --- Vertical connectors (left/right borders) ---
const VERTICAL_CONNECTORS = new Set([
  0x2502, // │
  0x2551, // ║
  0x2503, // ┃
  0x251c, // ├
  0x2524, // ┤
  0x2560, // ╠
  0x2563, // ╣
  0x2523, // ┣
  0x252b, // ┫
])

function isVerticalConnector(cp: number): boolean {
  return VERTICAL_CONNECTORS.has(cp)
}

function isHorizontalConnector(cp: number): boolean {
  return HORIZONTAL_CONNECTORS.has(cp)
}

/**
 * Read the codepoint at (row, col) from the DataView.
 */
function cpAt(view: DataView, row: number, col: number, cols: number): number {
  const offset = cellOffset(row, col, cols)
  return decodeCell(view, offset).codepoint
}

// --- Style detection from top-left corner codepoint ---
function detectStyle(tlCp: number): 'single' | 'double' | 'heavy' | 'rounded' {
  if (tlCp === 0x2554) return `double` // ╔
  if (tlCp === 0x250f) return `heavy` // ┏
  if (tlCp === 0x256d) return `rounded` // ╭
  return `single` // ┌ (0x250c) and fallback
}

/**
 * Extract the title from the top border row (between the corners).
 * Title characters are non-box-draw, non-empty cells on the top border.
 */
function extractTitle(
  view: DataView,
  topRow: number,
  leftCol: number,
  rightCol: number,
  cols: number,
  meta: TCellMeta[][]
): string | undefined {
  const titleChars: string[] = []
  for (let c = leftCol + 1; c < rightCol; c++) {
    const isBoxDraw = meta[topRow]?.[c]?.isBoxDraw ?? false
    if (isBoxDraw) continue
    const cp = cpAt(view, topRow, c, cols)
    if (cp !== 0 && cp !== 0x20) {
      titleChars.push(String.fromCodePoint(cp))
    }
  }
  if (titleChars.length === 0) return undefined
  return titleChars.join(``).trim() || undefined
}

/**
 * Scan the interior of a found frame for nested frames.
 */
function scanInterior(
  view: DataView,
  totalCols: number,
  _totalRows: number,
  meta: TCellMeta[][],
  scopeBounds: TRect
): TBorderFrame[] {
  return traceBordersScoped(view, totalCols, meta, scopeBounds)
}

/**
 * Core scanning loop: find all TBorderFrame within the given scopeBounds.
 */
function traceBordersScoped(
  view: DataView,
  cols: number,
  meta: TCellMeta[][],
  scope: TRect
): TBorderFrame[] {
  const frames: TBorderFrame[] = []

  for (let row = scope.top; row <= scope.bottom; row++) {
    for (let col = scope.left; col <= scope.right; col++) {
      // Must be box-draw and a top-left corner
      if (!meta[row]?.[col]?.isBoxDraw) continue
      const tlCp = cpAt(view, row, col, cols)
      if (!TOP_LEFT_CORNERS.has(tlCp)) continue

      // Trace RIGHT along top border to find top-right corner
      let trCol = -1
      for (let c = col + 1; c <= scope.right; c++) {
        const cp = cpAt(view, row, c, cols)
        const isBoxDraw = meta[row]?.[c]?.isBoxDraw ?? false

        if (TOP_RIGHT_CORNERS.has(cp)) {
          trCol = c
          break
        }

        if (!isHorizontalPassthrough(cp, isBoxDraw)) {
          // Empty/blank cell — stop tracing
          break
        }
      }

      if (trCol === -1) continue

      // Trace DOWN from top-right corner to find bottom-right corner
      let brRow = -1
      for (let r = row + 1; r <= scope.bottom; r++) {
        const cp = cpAt(view, r, trCol, cols)
        if (BOTTOM_RIGHT_CORNERS.has(cp)) {
          brRow = r
          break
        }
        if (!isVerticalConnector(cp)) break
      }

      if (brRow === -1) continue

      // Verify bottom-left corner exists
      const blCp = cpAt(view, brRow, col, cols)
      if (!BOTTOM_LEFT_CORNERS.has(blCp)) continue

      // Verify left border (col = col, rows row+1..brRow-1 are vertical connectors)
      let leftOk = true
      for (let r = row + 1; r < brRow; r++) {
        const cp = cpAt(view, r, col, cols)
        if (!isVerticalConnector(cp)) {
          leftOk = false
          break
        }
      }
      if (!leftOk) continue

      // Verify bottom border (row = brRow, cols col+1..trCol-1 are horizontal connectors)
      let bottomOk = true
      for (let c = col + 1; c < trCol; c++) {
        const cp = cpAt(view, brRow, c, cols)
        if (!isHorizontalConnector(cp)) {
          bottomOk = false
          break
        }
      }
      if (!bottomOk) continue

      // Build the bounds and interior
      const bounds: TRect = { top: row, left: col, bottom: brRow, right: trCol }
      const interior: TRect = {
        top: row + 1,
        left: col + 1,
        bottom: brRow - 1,
        right: trCol - 1,
      }

      // Determine border style from top-left corner
      const style = detectStyle(tlCp)

      // Extract optional title from top border
      const title = extractTitle(view, row, col, trCol, cols, meta)

      frames.push({ type: `BorderFrame`, bounds, interior, style, title })

      // Recurse into interior for nested frames
      if (brRow - row > 2 && trCol - col > 2) {
        const nested = scanInterior(view, cols, 0, meta, interior)
        frames.push(...nested)
      }
    }
  }

  return frames
}

/**
 * Find all border frames (closed rectangles of box-drawing characters)
 * within the given viewport.
 *
 * @param view    DataView over the raw WASM cell buffer
 * @param cols    Terminal column count
 * @param rows    Terminal row count
 * @param meta    Cell metadata grid (rows × cols) from classifyCells
 * @param scopeBounds  Optional sub-region to search; defaults to full viewport
 */
export function traceBorders(
  view: DataView,
  cols: number,
  rows: number,
  meta: TCellMeta[][],
  scopeBounds?: TRect
): TBorderFrame[] {
  const scope: TRect = scopeBounds ?? {
    top: 0,
    left: 0,
    bottom: rows - 1,
    right: cols - 1,
  }
  return traceBordersScoped(view, cols, meta, scope)
}
