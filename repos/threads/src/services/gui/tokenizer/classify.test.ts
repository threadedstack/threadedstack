import type { TPalette } from '@TTH/types/tokenizer.types'

import { describe, it, expect } from 'vitest'
import { buildTestViewport } from './decode'
import { classifyCells } from './classify'

const defaultPalette: TPalette = {
  defaultBg: { r: 0, g: 0, b: 0 },
  defaultFg: { r: 200, g: 200, b: 200 },
}

describe(`classifyCells`, () => {
  describe(`empty cells`, () => {
    it(`classifies zero-codepoint cells as isEmpty and isBlank`, () => {
      const { view, cols, rows } = buildTestViewport(4, 2)
      const grid = classifyCells(view, cols, rows, defaultPalette)

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          expect(grid[row][col].isEmpty).toBe(true)
          expect(grid[row][col].isBlank).toBe(true)
          expect(grid[row][col].isBoxDraw).toBe(false)
          expect(grid[row][col].isHighlighted).toBe(false)
          expect(grid[row][col].hasLink).toBe(false)
        }
      }
    })

    it(`classifies space (0x20) codepoint cells as isEmpty and isBlank`, () => {
      const { view, cols, rows } = buildTestViewport(3, 1, [
        { row: 0, col: 0, text: ` ` },
        { row: 0, col: 1, text: ` ` },
        { row: 0, col: 2, text: ` ` },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      for (let col = 0; col < cols; col++) {
        expect(grid[0][col].isEmpty).toBe(true)
        expect(grid[0][col].isBlank).toBe(true)
      }
    })

    it(`classifies highlighted empty cell as isEmpty but NOT isBlank`, () => {
      const { view, cols, rows } = buildTestViewport(3, 1, [
        { row: 0, col: 1, text: ` `, bg: { r: 50, g: 50, b: 50 } },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][1].isEmpty).toBe(true)
      expect(grid[0][1].isBlank).toBe(false)
      expect(grid[0][1].isHighlighted).toBe(true)
    })
  })

  describe(`box-drawing characters`, () => {
    it(`classifies U+2500 (─) as isBoxDraw`, () => {
      const { view, cols, rows } = buildTestViewport(3, 1, [
        { row: 0, col: 1, text: `─` }, // U+2500
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][1].isBoxDraw).toBe(true)
      expect(grid[0][1].isEmpty).toBe(false)
    })

    it(`classifies U+257F (last in block-draw range) as isBoxDraw`, () => {
      const { view, cols, rows } = buildTestViewport(2, 1, [
        { row: 0, col: 0, text: `\u257F` },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isBoxDraw).toBe(true)
    })

    it(`classifies U+2580 (▀) as isBoxDraw (block elements range)`, () => {
      const { view, cols, rows } = buildTestViewport(2, 1, [
        { row: 0, col: 0, text: `▀` }, // U+2580
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isBoxDraw).toBe(true)
    })

    it(`classifies U+259F (last in block elements range) as isBoxDraw`, () => {
      const { view, cols, rows } = buildTestViewport(2, 1, [
        { row: 0, col: 0, text: `\u259F` },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isBoxDraw).toBe(true)
    })

    it(`does NOT classify a regular ASCII character as isBoxDraw`, () => {
      const { view, cols, rows } = buildTestViewport(2, 1, [
        { row: 0, col: 0, text: `A` },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isBoxDraw).toBe(false)
    })
  })

  describe(`highlighted cells`, () => {
    it(`classifies cell with bg ≠ defaultBg as isHighlighted`, () => {
      const { view, cols, rows } = buildTestViewport(3, 1, [
        { row: 0, col: 1, text: `X`, bg: { r: 30, g: 60, b: 90 } },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][1].isHighlighted).toBe(true)
    })

    it(`does NOT classify cell with bg === defaultBg as isHighlighted`, () => {
      const { view, cols, rows } = buildTestViewport(3, 1, [
        { row: 0, col: 1, text: `X`, bg: defaultPalette.defaultBg },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][1].isHighlighted).toBe(false)
    })

    it(`classifies cell with fg ≠ defaultFg as isFgStyled`, () => {
      const { view, cols, rows } = buildTestViewport(2, 1, [
        { row: 0, col: 0, text: `Z`, fg: { r: 255, g: 100, b: 0 } },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isFgStyled).toBe(true)
    })

    it(`does NOT classify cell with fg === defaultFg as isFgStyled`, () => {
      const { view, cols, rows } = buildTestViewport(2, 1, [
        { row: 0, col: 0, text: `Z`, fg: defaultPalette.defaultFg },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isFgStyled).toBe(false)
    })
  })

  describe(`hyperlink cells`, () => {
    it(`classifies cell with linkId > 0 as hasLink`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 2, text: `h`, hyperlinkId: 5 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][2].hasLink).toBe(true)
    })

    it(`does NOT classify cell with linkId === 0 as hasLink`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 2, text: `h`, hyperlinkId: 0 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][2].hasLink).toBe(false)
    })

    it(`classifies multiple linked cells in a row`, () => {
      const { view, cols, rows } = buildTestViewport(5, 1, [
        { row: 0, col: 0, text: `h`, hyperlinkId: 1 },
        { row: 0, col: 1, text: `t`, hyperlinkId: 1 },
        { row: 0, col: 2, text: `t`, hyperlinkId: 1 },
        { row: 0, col: 3, text: `p`, hyperlinkId: 1 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].hasLink).toBe(true)
      expect(grid[0][1].hasLink).toBe(true)
      expect(grid[0][2].hasLink).toBe(true)
      expect(grid[0][3].hasLink).toBe(true)
      expect(grid[0][4].hasLink).toBe(false)
    })
  })

  describe(`wide cells`, () => {
    it(`classifies cell with width=2 as isWide`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 1, text: `漢`, width: 2 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][1].isWide).toBe(true)
      expect(grid[0][1].isWideRight).toBe(false)
    })

    it(`classifies the cell immediately after a wide cell as isWideRight`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 1, text: `漢`, width: 2 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][2].isWideRight).toBe(true)
      expect(grid[0][2].isWide).toBe(false)
    })

    it(`does NOT classify first col as isWideRight`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isWideRight).toBe(false)
    })

    it(`does NOT classify cell after normal-width cell as isWideRight`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 1, text: `A`, width: 1 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][2].isWideRight).toBe(false)
    })

    it(`isWideRight is row-local — wide cell in row 0 does not affect row 1 col 0`, () => {
      const { view, cols, rows } = buildTestViewport(4, 2, [
        { row: 0, col: 3, text: `漢`, width: 2 },
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      // col 0 of row 1 should not be affected by row 0 col 3
      expect(grid[1][0].isWideRight).toBe(false)
    })
  })

  describe(`grid structure`, () => {
    it(`returns a grid with correct dimensions`, () => {
      const cols = 8
      const rows = 5
      const { view } = buildTestViewport(cols, rows)
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid.length).toBe(rows)
      for (let row = 0; row < rows; row++) {
        expect(grid[row].length).toBe(cols)
      }
    })

    it(`classifies a mixed row correctly`, () => {
      const { view, cols, rows } = buildTestViewport(6, 1, [
        { row: 0, col: 0, text: `─` }, // box-draw
        { row: 0, col: 1, text: `X`, bg: { r: 10, g: 10, b: 10 } }, // highlighted
        { row: 0, col: 2, text: `L`, hyperlinkId: 3 }, // link
        { row: 0, col: 3, text: `字`, width: 2 }, // wide
        // col 4 is the wide-right cell
        // col 5 is empty
      ])
      const grid = classifyCells(view, cols, rows, defaultPalette)

      expect(grid[0][0].isBoxDraw).toBe(true)
      expect(grid[0][1].isHighlighted).toBe(true)
      expect(grid[0][2].hasLink).toBe(true)
      expect(grid[0][3].isWide).toBe(true)
      expect(grid[0][4].isWideRight).toBe(true)
      expect(grid[0][5].isBlank).toBe(true)
    })
  })
})
