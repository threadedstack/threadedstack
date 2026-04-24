import type { RGB } from '@TTH/types/ast.types'
import type { TPalette } from '@TTH/types/tokenizer.types'
import { decodeCell, resolveColors, cellOffset } from './decode'

function rgbKey(c: RGB): string {
  return `${c.r},${c.g},${c.b}`
}

function mostFrequent(counts: Map<string, { color: RGB; count: number }>): RGB {
  let best: RGB = { r: 0, g: 0, b: 0 }
  let bestCount = 0
  for (const { color, count } of counts.values()) {
    if (count > bestCount) {
      bestCount = count
      best = color
    }
  }
  return best
}

export function detectPalette(view: DataView, cols: number, rows: number): TPalette {
  const bgCounts = new Map<string, { color: RGB; count: number }>()
  const fgCounts = new Map<string, { color: RGB; count: number }>()

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offset = cellOffset(row, col, cols)
      const cell = decodeCell(view, offset)

      // Skip completely uninitialized cells
      if (
        cell.codepoint === 0 &&
        cell.fg.r === 0 &&
        cell.fg.g === 0 &&
        cell.fg.b === 0 &&
        cell.bg.r === 0 &&
        cell.bg.g === 0 &&
        cell.bg.b === 0 &&
        cell.flags === 0 &&
        cell.width === 0
      ) {
        continue
      }

      const { fg, bg } = resolveColors(cell)

      // Count bg for every non-uninitialized cell
      const bgK = rgbKey(bg)
      const bgEntry = bgCounts.get(bgK)
      if (bgEntry) bgEntry.count++
      else bgCounts.set(bgK, { color: bg, count: 1 })

      // Count fg only for non-empty (non-space) cells
      const cp = cell.codepoint
      if (cp !== 0 && cp !== 0x20) {
        const fgK = rgbKey(fg)
        const fgEntry = fgCounts.get(fgK)
        if (fgEntry) fgEntry.count++
        else fgCounts.set(fgK, { color: fg, count: 1 })
      }
    }
  }

  return {
    defaultBg: mostFrequent(bgCounts),
    defaultFg: mostFrequent(fgCounts),
  }
}
