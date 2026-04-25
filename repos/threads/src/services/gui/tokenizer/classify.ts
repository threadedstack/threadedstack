import type { TPalette, TCellMeta } from '@TTH/types/tokenizer.types'
import { decodeCell, resolveColors, cellOffset } from './decode'

function rgbEqual(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b
}

/**
 * Single-pass O(cols × rows) scan that classifies each cell with metadata bits.
 * Returns a rows × cols grid of TCellMeta.
 */
export function classifyCells(
  view: DataView,
  cols: number,
  rows: number,
  palette: TPalette
): TCellMeta[][] {
  const grid: TCellMeta[][] = []

  for (let row = 0; row < rows; row++) {
    const rowMeta: TCellMeta[] = []

    for (let col = 0; col < cols; col++) {
      const offset = cellOffset(row, col, cols)
      const cell = decodeCell(view, offset)
      const { fg, bg } = resolveColors(cell)

      const isBoxDraw =
        (cell.codepoint >= 0x2500 && cell.codepoint <= 0x257f) ||
        (cell.codepoint >= 0x2580 && cell.codepoint <= 0x259f)

      const isHighlighted = !rgbEqual(bg, palette.defaultBg)
      const isFgStyled = !rgbEqual(fg, palette.defaultFg)

      const isEmpty = cell.codepoint === 0 || cell.codepoint === 0x20
      const isBlank = isEmpty && !isHighlighted

      const isWide = cell.width === 2
      const isWideRight = col > 0 && rowMeta[col - 1].isWide

      const hasLink = cell.hyperlinkId > 0

      rowMeta.push({
        isBoxDraw,
        isHighlighted,
        isFgStyled,
        isEmpty,
        isBlank,
        isWide,
        isWideRight,
        hasLink,
      })
    }

    grid.push(rowMeta)
  }

  return grid
}
