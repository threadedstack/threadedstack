import type { RGB, TTestViewport, TDecodedCell, TViewportFill } from '@TTH/types'
import { CellFlags, GhosttyVTCellSize } from '@TTH/constants/tokenizer'

/**
 * Byte layout (16 bytes, little-endian):
 *   0-3:   codepoint (u32 LE)
 *   4:     fg_r
 *   5:     fg_g
 *   6:     fg_b
 *   7:     bg_r
 *   8:     bg_g
 *   9:     bg_b
 *   10:    flags
 *   11:    width
 *   12-13: hyperlink_id (u16 LE)
 *   14:    grapheme_len
 *   15:    reserved
 */
export function decodeCell(view: DataView, offset: number): TDecodedCell {
  const codepoint = view.getUint32(offset + 0, true)
  const fg: RGB = {
    r: view.getUint8(offset + 4),
    g: view.getUint8(offset + 5),
    b: view.getUint8(offset + 6),
  }
  const bg: RGB = {
    r: view.getUint8(offset + 7),
    g: view.getUint8(offset + 8),
    b: view.getUint8(offset + 9),
  }
  const flags = view.getUint8(offset + 10)
  const width = view.getUint8(offset + 11)
  const hyperlinkId = view.getUint16(offset + 12, true)
  const graphemeLen = view.getUint8(offset + 14)

  return {
    fg,
    bg,
    width,
    flags,
    codepoint,
    hyperlinkId,
    graphemeLen,
  }
}

export function resolveColors(cell: TDecodedCell): { fg: RGB; bg: RGB } {
  if (cell.flags & CellFlags.INVERSE) {
    return { fg: cell.bg, bg: cell.fg }
  }
  return { fg: cell.fg, bg: cell.bg }
}

export function cellOffset(row: number, col: number, cols: number): number {
  return (row * cols + col) * GhosttyVTCellSize
}

export function buildTestViewport(
  cols: number,
  rows: number,
  fills?: TViewportFill[]
): TTestViewport {
  const totalBytes = cols * rows * GhosttyVTCellSize
  const buffer = new ArrayBuffer(totalBytes)
  const view = new DataView(buffer)

  if (fills) {
    for (const fill of fills) {
      const { row, col, text, fg, bg, flags, width, hyperlinkId } = fill
      const offset = cellOffset(row, col, cols)
      const codepoint = text.codePointAt(0) ?? 0
      const fgColor: RGB = fg ?? { r: 0, g: 0, b: 0 }
      const bgColor: RGB = bg ?? { r: 0, g: 0, b: 0 }
      const cellWidth = width ?? 1
      const graphemeLen = 1

      view.setUint32(offset + 0, codepoint, true)
      view.setUint8(offset + 4, fgColor.r)
      view.setUint8(offset + 5, fgColor.g)
      view.setUint8(offset + 6, fgColor.b)
      view.setUint8(offset + 7, bgColor.r)
      view.setUint8(offset + 8, bgColor.g)
      view.setUint8(offset + 9, bgColor.b)
      view.setUint8(offset + 10, flags ?? 0)
      view.setUint8(offset + 11, cellWidth)
      view.setUint16(offset + 12, hyperlinkId ?? 0, true)
      view.setUint8(offset + 14, graphemeLen)
      // byte 15: reserved, leave as 0
    }
  }

  return { view, cols, rows }
}
