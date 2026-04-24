import { describe, it, expect } from 'vitest'
import { buildTestViewport } from './decode'
import { tokenize } from './tokenizer'

const defaultCursor = { x: 0, y: 0, visible: false }

describe(`tokenize`, () => {
  describe(`simple viewport with text`, () => {
    it(`produces TextRun tokens for a row of text`, () => {
      const { view, cols, rows } = buildTestViewport(10, 3, [
        { row: 1, col: 0, text: `H`, fg: { r: 200, g: 200, b: 200 } },
        { row: 1, col: 1, text: `e`, fg: { r: 200, g: 200, b: 200 } },
        { row: 1, col: 2, text: `l`, fg: { r: 200, g: 200, b: 200 } },
        { row: 1, col: 3, text: `l`, fg: { r: 200, g: 200, b: 200 } },
        { row: 1, col: 4, text: `o`, fg: { r: 200, g: 200, b: 200 } },
      ])

      const result = tokenize(view, cols, rows, defaultCursor)

      const textRuns = result.tokens.filter((t) => t.type === `TextRun`)
      expect(textRuns.length).toBeGreaterThan(0)
    })

    it(`returns a palette from the viewport data`, () => {
      const { view, cols, rows } = buildTestViewport(8, 2, [
        {
          row: 0,
          col: 0,
          text: `A`,
          fg: { r: 255, g: 255, b: 255 },
          bg: { r: 30, g: 30, b: 30 },
        },
        {
          row: 0,
          col: 1,
          text: `B`,
          fg: { r: 255, g: 255, b: 255 },
          bg: { r: 30, g: 30, b: 30 },
        },
        {
          row: 0,
          col: 2,
          text: `C`,
          fg: { r: 255, g: 255, b: 255 },
          bg: { r: 30, g: 30, b: 30 },
        },
      ])

      const result = tokenize(view, cols, rows, defaultCursor)

      expect(result.palette).toBeDefined()
      expect(result.palette.defaultBg).toBeDefined()
      expect(result.palette.defaultFg).toBeDefined()
    })

    it(`returns meta grid with correct dimensions`, () => {
      const cols = 10
      const rows = 4
      const { view } = buildTestViewport(cols, rows)

      const result = tokenize(view, cols, rows, defaultCursor)

      expect(result.meta).toHaveLength(rows)
      for (const row of result.meta) {
        expect(row).toHaveLength(cols)
      }
    })

    it(`reuses prevPalette when dirtyRows is a small fraction`, () => {
      const { view, cols, rows } = buildTestViewport(8, 10, [
        {
          row: 0,
          col: 0,
          text: `X`,
          fg: { r: 100, g: 100, b: 100 },
          bg: { r: 50, g: 50, b: 50 },
        },
      ])

      const prevPalette = {
        defaultBg: { r: 10, g: 20, b: 30 },
        defaultFg: { r: 200, g: 210, b: 220 },
      }

      // Only 1 dirty row out of 10 = 10% — should reuse prevPalette
      const result = tokenize(view, cols, rows, defaultCursor, prevPalette, [0])

      expect(result.palette).toBe(prevPalette)
    })

    it(`re-detects palette when dirtyRows is more than 50% of rows`, () => {
      const { view, cols, rows } = buildTestViewport(8, 4, [
        {
          row: 0,
          col: 0,
          text: `X`,
          fg: { r: 100, g: 100, b: 100 },
          bg: { r: 50, g: 50, b: 50 },
        },
      ])

      const prevPalette = {
        defaultBg: { r: 10, g: 20, b: 30 },
        defaultFg: { r: 200, g: 210, b: 220 },
      }

      // 3 dirty rows out of 4 = 75% — should re-detect
      const result = tokenize(view, cols, rows, defaultCursor, prevPalette, [0, 1, 2])

      expect(result.palette).not.toBe(prevPalette)
    })
  })

  describe(`viewport with a border frame`, () => {
    it(`produces a BorderFrame token for a single-style frame`, () => {
      // Build a 10x5 viewport with a single-style border frame at rows 0-4, cols 0-9
      const cols = 10
      const rows = 5
      const fills = [
        // Top-left corner
        { row: 0, col: 0, text: `\u250c` }, // ┌
        // Top border
        { row: 0, col: 1, text: `\u2500` }, // ─
        { row: 0, col: 2, text: `\u2500` },
        { row: 0, col: 3, text: `\u2500` },
        { row: 0, col: 4, text: `\u2500` },
        { row: 0, col: 5, text: `\u2500` },
        { row: 0, col: 6, text: `\u2500` },
        { row: 0, col: 7, text: `\u2500` },
        { row: 0, col: 8, text: `\u2500` },
        // Top-right corner
        { row: 0, col: 9, text: `\u2510` }, // ┐
        // Left border
        { row: 1, col: 0, text: `\u2502` }, // │
        { row: 2, col: 0, text: `\u2502` },
        { row: 3, col: 0, text: `\u2502` },
        // Right border
        { row: 1, col: 9, text: `\u2502` },
        { row: 2, col: 9, text: `\u2502` },
        { row: 3, col: 9, text: `\u2502` },
        // Bottom-left corner
        { row: 4, col: 0, text: `\u2514` }, // └
        // Bottom border
        { row: 4, col: 1, text: `\u2500` },
        { row: 4, col: 2, text: `\u2500` },
        { row: 4, col: 3, text: `\u2500` },
        { row: 4, col: 4, text: `\u2500` },
        { row: 4, col: 5, text: `\u2500` },
        { row: 4, col: 6, text: `\u2500` },
        { row: 4, col: 7, text: `\u2500` },
        { row: 4, col: 8, text: `\u2500` },
        // Bottom-right corner
        { row: 4, col: 9, text: `\u2518` }, // ┘
      ]

      const { view } = buildTestViewport(cols, rows, fills)
      const result = tokenize(view, cols, rows, defaultCursor)

      const frames = result.tokens.filter((t) => t.type === `BorderFrame`)
      expect(frames.length).toBeGreaterThan(0)
      expect(frames[0].type).toBe(`BorderFrame`)
      // @ts-ignore — we know it's a BorderFrame
      expect(frames[0].style).toBe(`single`)
      // @ts-ignore
      expect(frames[0].bounds).toEqual({ top: 0, left: 0, bottom: 4, right: 9 })
    })
  })

  describe(`cursor token`, () => {
    it(`includes a CursorToken with correct position when visible`, () => {
      const { view, cols, rows } = buildTestViewport(8, 4)
      const cursor = { x: 3, y: 2, visible: true }

      const result = tokenize(view, cols, rows, cursor)

      expect(result.cursor.type).toBe(`CursorToken`)
      expect(result.cursor.position).toEqual({ x: 3, y: 2 })
      expect(result.cursor.visible).toBe(true)

      const cursorInTokens = result.tokens.find((t) => t.type === `CursorToken`)
      expect(cursorInTokens).toBeDefined()
      // @ts-ignore
      expect(cursorInTokens?.position).toEqual({ x: 3, y: 2 })
    })

    it(`includes a CursorToken with visible=false when cursor is hidden`, () => {
      const { view, cols, rows } = buildTestViewport(8, 4)
      const cursor = { x: 0, y: 0, visible: false }

      const result = tokenize(view, cols, rows, cursor)

      expect(result.cursor.visible).toBe(false)
    })

    it(`cursor token is always the last token in the array`, () => {
      const { view, cols, rows } = buildTestViewport(8, 4, [
        { row: 1, col: 1, text: `A` },
      ])
      const cursor = { x: 5, y: 3, visible: true }

      const result = tokenize(view, cols, rows, cursor)

      const last = result.tokens[result.tokens.length - 1]
      expect(last.type).toBe(`CursorToken`)
    })
  })
})
