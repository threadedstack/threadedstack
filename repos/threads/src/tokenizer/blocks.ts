import type { TRect } from '../ast/types'
import type { TCellMeta, THighlightedBlock } from './types'

/**
 * Flood-fill (4-connected) starting at (startRow, startCol) within scope bounds.
 * Marks visited cells and returns all cells in the component.
 */
function floodFill(
  meta: TCellMeta[][],
  scope: TRect,
  startRow: number,
  startCol: number,
  visited: boolean[][]
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = []
  const stack: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }]

  while (stack.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: stack is non-empty
    const { row, col } = stack.pop()!

    if (row < scope.top || row > scope.bottom || col < scope.left || col > scope.right) {
      continue
    }

    if (visited[row][col]) continue

    const cell = meta[row]?.[col]
    if (!cell?.isHighlighted) continue

    visited[row][col] = true
    cells.push({ row, col })

    stack.push({ row: row - 1, col })
    stack.push({ row: row + 1, col })
    stack.push({ row, col: col - 1 })
    stack.push({ row, col: col + 1 })
  }

  return cells
}

/**
 * Segment highlighted cells into connected components (THighlightedBlock tokens).
 *
 * Uses 4-connected flood fill to find each component, computes a bounding box,
 * then classifies the shape as 'multi-row', 'full-width', or 'small'.
 *
 * NOTE: The `color` field is set to a zero-RGB placeholder. The tokenizer
 * orchestrator (Task 7) will fill in the actual RGB value from the DataView
 * after this function returns.
 */
export function segmentBlocks(
  meta: TCellMeta[][],
  scope: TRect,
  scopeWidth: number
): THighlightedBlock[] {
  const blocks: THighlightedBlock[] = []

  // Build visited grid sized to match meta dimensions
  const totalRows = meta.length
  const totalCols = totalRows > 0 ? meta[0].length : 0

  const visited: boolean[][] = Array.from({ length: totalRows }, () =>
    new Array(totalCols).fill(false)
  )

  for (let row = scope.top; row <= scope.bottom; row++) {
    for (let col = scope.left; col <= scope.right; col++) {
      const cell = meta[row]?.[col]
      if (!cell?.isHighlighted) continue
      if (visited[row][col]) continue

      // Found an unvisited highlighted cell — flood fill to get the component
      const component = floodFill(meta, scope, row, col, visited)
      if (component.length === 0) continue

      // Compute bounding box
      let minRow = component[0].row
      let maxRow = component[0].row
      let minCol = component[0].col
      let maxCol = component[0].col

      for (const cell of component) {
        if (cell.row < minRow) minRow = cell.row
        if (cell.row > maxRow) maxRow = cell.row
        if (cell.col < minCol) minCol = cell.col
        if (cell.col > maxCol) maxCol = cell.col
      }

      const bounds: TRect = { top: minRow, left: minCol, bottom: maxRow, right: maxCol }
      const height = maxRow - minRow + 1
      const width = maxCol - minCol + 1

      let shape: 'full-width' | 'small' | 'multi-row'
      if (height > 1) {
        shape = 'multi-row'
      } else if (width >= scopeWidth) {
        shape = 'full-width'
      } else {
        shape = 'small'
      }

      blocks.push({
        type: 'HighlightedBlock',
        bounds,
        color: { r: 0, g: 0, b: 0 },
        shape,
      })
    }
  }

  return blocks
}
