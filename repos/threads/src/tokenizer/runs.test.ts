import type { TPalette, TBorderFrame } from '@TTH/types/tokenizer.types'
import type { TRect } from '@TTH/types/ast.types'

import { describe, it, expect } from 'vitest'
import { buildTestViewport } from './decode'
import { classifyCells } from './classify'
import { extractRuns } from './runs'

const defaultPalette: TPalette = {
  defaultBg: { r: 0, g: 0, b: 0 },
  defaultFg: { r: 200, g: 200, b: 200 },
}

const noFrames: TBorderFrame[] = []

describe(`extractRuns`, () => {
  describe(`single text run`, () => {
    it(`extracts a single TextRun with correct text`, () => {
      const { view, cols, rows } = buildTestViewport(5, 1, [
        { row: 0, col: 0, text: `H` },
        { row: 0, col: 1, text: `e` },
        { row: 0, col: 2, text: `l` },
        { row: 0, col: 3, text: `l` },
        { row: 0, col: 4, text: `o` },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { textRuns, gaps, links } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(1)
      expect(gaps).toHaveLength(0)
      expect(links).toHaveLength(0)

      const run = textRuns[0]
      expect(run.type).toBe(`TextRun`)
      expect(run.bounds).toEqual({ top: 0, left: 0, bottom: 0, right: 4 })
      expect(run.spans).toHaveLength(1)
      expect(run.spans[0].text).toBe(`Hello`)
    })

    it(`sets correct bounds for a partial row run`, () => {
      // Only cols 1-3 contain text; col 0 and 4 are blank
      const { view, cols, rows } = buildTestViewport(5, 1, [
        { row: 0, col: 1, text: `A` },
        { row: 0, col: 2, text: `B` },
        { row: 0, col: 3, text: `C` },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { textRuns } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(1)
      expect(textRuns[0].bounds).toEqual({ top: 0, left: 1, bottom: 0, right: 3 })
      expect(textRuns[0].spans[0].text).toBe(`ABC`)
    })
  })

  describe(`style boundary splits spans`, () => {
    it(`splits into two spans when fg color changes mid-run`, () => {
      const fg1 = { r: 255, g: 0, b: 0 }
      const fg2 = { r: 0, g: 255, b: 0 }

      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 0, text: `A`, fg: fg1 },
        { row: 0, col: 1, text: `B`, fg: fg1 },
        { row: 0, col: 2, text: `C`, fg: fg2 },
        { row: 0, col: 3, text: `D`, fg: fg2 },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { textRuns } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(1)
      const run = textRuns[0]
      expect(run.spans).toHaveLength(2)
      expect(run.spans[0].text).toBe(`AB`)
      expect(run.spans[0].fg).toEqual(fg1)
      expect(run.spans[1].text).toBe(`CD`)
      expect(run.spans[1].fg).toEqual(fg2)
    })

    it(`splits into two spans when bg color changes mid-run`, () => {
      const bg1 = { r: 10, g: 10, b: 10 }
      const bg2 = { r: 20, g: 20, b: 20 }

      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 0, text: `X`, bg: bg1 },
        { row: 0, col: 1, text: `Y`, bg: bg1 },
        { row: 0, col: 2, text: `Z`, bg: bg2 },
        { row: 0, col: 3, text: `W`, bg: bg2 },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { textRuns } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(1)
      expect(textRuns[0].spans).toHaveLength(2)
      expect(textRuns[0].spans[0].text).toBe(`XY`)
      expect(textRuns[0].spans[1].text).toBe(`ZW`)
    })

    it(`splits into multiple spans when flags change`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 0, text: `A`, flags: 0x00 }, // normal
        { row: 0, col: 1, text: `B`, flags: 0x00 }, // normal
        { row: 0, col: 2, text: `C`, flags: 0x01 }, // bold
        { row: 0, col: 3, text: `D`, flags: 0x01 }, // bold
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { textRuns } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(1)
      const run = textRuns[0]
      expect(run.spans).toHaveLength(2)
      expect(run.spans[0].text).toBe(`AB`)
      expect(run.spans[1].text).toBe(`CD`)
    })
  })

  describe(`whitespace gaps`, () => {
    it(`produces a WhitespaceGap for a blank row between content rows`, () => {
      // row 0: text, row 1: blank, row 2: text
      const { view, cols, rows } = buildTestViewport(4, 3, [
        { row: 0, col: 0, text: `A` },
        // row 1 left blank
        { row: 2, col: 0, text: `B` },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const { textRuns, gaps } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(2)
      expect(gaps).toHaveLength(1)
      expect(gaps[0].type).toBe(`WhitespaceGap`)
      expect(gaps[0].height).toBe(1)
      expect(gaps[0].bounds).toEqual({ top: 1, left: 0, bottom: 1, right: cols - 1 })
    })

    it(`collapses multiple consecutive blank rows into a single gap`, () => {
      // row 0: text, rows 1-3: blank, row 4: text
      const { view, cols, rows } = buildTestViewport(4, 5, [
        { row: 0, col: 0, text: `A` },
        // rows 1, 2, 3 blank
        { row: 4, col: 0, text: `B` },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const { gaps } = extractRuns(view, cols, meta, scope, noFrames)

      expect(gaps).toHaveLength(1)
      expect(gaps[0].height).toBe(3)
      expect(gaps[0].bounds).toEqual({ top: 1, left: 0, bottom: 3, right: cols - 1 })
    })

    it(`produces a trailing gap when the viewport ends with blank rows`, () => {
      const { view, cols, rows } = buildTestViewport(4, 3, [
        { row: 0, col: 0, text: `A` },
        // rows 1-2 blank
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const { gaps } = extractRuns(view, cols, meta, scope, noFrames)

      expect(gaps).toHaveLength(1)
      expect(gaps[0].height).toBe(2)
    })
  })

  describe(`link spans`, () => {
    it(`extracts a LinkSpan for cells with a hyperlinkId`, () => {
      const { view, cols, rows } = buildTestViewport(3, 1, [
        { row: 0, col: 0, text: `A`, hyperlinkId: 42 },
        { row: 0, col: 1, text: `B`, hyperlinkId: 42 },
        { row: 0, col: 2, text: `C`, hyperlinkId: 42 },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { links, textRuns } = extractRuns(view, cols, meta, scope, noFrames)

      expect(links).toHaveLength(1)
      expect(links[0].type).toBe(`LinkSpan`)
      expect(links[0].hyperlinkId).toBe(42)
      expect(links[0].text).toBe(`ABC`)
      expect(links[0].bounds).toEqual({ top: 0, left: 0, bottom: 0, right: 2 })
      // Link cells do not produce TextRun spans
      expect(textRuns).toHaveLength(0)
    })

    it(`splits links on different hyperlinkIds`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 0, text: `A`, hyperlinkId: 1 },
        { row: 0, col: 1, text: `B`, hyperlinkId: 1 },
        { row: 0, col: 2, text: `C`, hyperlinkId: 2 },
        { row: 0, col: 3, text: `D`, hyperlinkId: 2 },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { links } = extractRuns(view, cols, meta, scope, noFrames)

      expect(links).toHaveLength(2)
      expect(links[0].hyperlinkId).toBe(1)
      expect(links[0].text).toBe(`AB`)
      expect(links[1].hyperlinkId).toBe(2)
      expect(links[1].text).toBe(`CD`)
    })

    it(`mixes link spans and text runs on the same row`, () => {
      const { view, cols, rows } = buildTestViewport(4, 1, [
        { row: 0, col: 0, text: `X` },
        { row: 0, col: 1, text: `Y` },
        { row: 0, col: 2, text: `L`, hyperlinkId: 5 },
        { row: 0, col: 3, text: `K`, hyperlinkId: 5 },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: 0, right: cols - 1 }

      const { textRuns, links } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(1)
      expect(textRuns[0].spans[0].text).toBe(`XY`)
      expect(links).toHaveLength(1)
      expect(links[0].text).toBe(`LK`)
    })
  })

  describe(`child frame exclusion`, () => {
    it(`skips cells inside a child frame boundary`, () => {
      // 8 cols x 3 rows; a frame covers cols 2-5, rows 0-2
      // Text at col 0 and col 7 should appear; cols 2-5 are inside the frame
      const frame: TBorderFrame = {
        type: `BorderFrame`,
        bounds: { top: 0, left: 2, bottom: 2, right: 5 },
        interior: { top: 1, left: 3, bottom: 1, right: 4 },
        style: `single`,
      }
      const { view, cols, rows } = buildTestViewport(8, 1, [
        { row: 0, col: 0, text: `A` },
        { row: 0, col: 3, text: `X` }, // inside frame — should be skipped
        { row: 0, col: 7, text: `B` },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const { textRuns } = extractRuns(view, cols, meta, scope, [frame])

      // Only A and B should appear, in separate runs (gap at frame cols between them)
      expect(textRuns.length).toBeGreaterThanOrEqual(1)
      const allText = textRuns.flatMap((r) => r.spans.map((s) => s.text)).join(``)
      expect(allText).toContain(`A`)
      expect(allText).toContain(`B`)
      expect(allText).not.toContain(`X`)
    })
  })

  describe(`empty viewport`, () => {
    it(`returns empty arrays for a blank viewport`, () => {
      const { view, cols, rows } = buildTestViewport(6, 4)
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const { textRuns, gaps, links } = extractRuns(view, cols, meta, scope, noFrames)

      expect(textRuns).toHaveLength(0)
      expect(links).toHaveLength(0)
      // All rows are blank -> one big gap
      expect(gaps).toHaveLength(1)
      expect(gaps[0].height).toBe(rows)
    })
  })
})
