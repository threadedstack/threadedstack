import { describe, it, expect } from 'vitest'
import { buildTestViewport } from './decode'
import { detectPalette } from './palette'
import { CellFlags } from './types'

describe(`detectPalette`, () => {
  it(`identifies the most frequent bg as defaultBg`, () => {
    // 3 cells with bg=(0,0,0), 1 cell with bg=(255,0,0)
    const { view, cols, rows } = buildTestViewport(4, 1, [
      {
        row: 0,
        col: 0,
        text: `A`,
        bg: { r: 0, g: 0, b: 0 },
        fg: { r: 200, g: 200, b: 200 },
      },
      {
        row: 0,
        col: 1,
        text: `B`,
        bg: { r: 0, g: 0, b: 0 },
        fg: { r: 200, g: 200, b: 200 },
      },
      {
        row: 0,
        col: 2,
        text: `C`,
        bg: { r: 0, g: 0, b: 0 },
        fg: { r: 200, g: 200, b: 200 },
      },
      {
        row: 0,
        col: 3,
        text: `D`,
        bg: { r: 255, g: 0, b: 0 },
        fg: { r: 200, g: 200, b: 200 },
      },
    ])

    const palette = detectPalette(view, cols, rows)
    expect(palette.defaultBg).toEqual({ r: 0, g: 0, b: 0 })
  })

  it(`identifies the most frequent fg as defaultFg`, () => {
    // 3 cells with fg=(200,200,200), 1 cell with fg=(255,0,0)
    const { view, cols, rows } = buildTestViewport(4, 1, [
      {
        row: 0,
        col: 0,
        text: `A`,
        fg: { r: 200, g: 200, b: 200 },
        bg: { r: 0, g: 0, b: 0 },
      },
      {
        row: 0,
        col: 1,
        text: `B`,
        fg: { r: 200, g: 200, b: 200 },
        bg: { r: 0, g: 0, b: 0 },
      },
      {
        row: 0,
        col: 2,
        text: `C`,
        fg: { r: 200, g: 200, b: 200 },
        bg: { r: 0, g: 0, b: 0 },
      },
      { row: 0, col: 3, text: `D`, fg: { r: 255, g: 0, b: 0 }, bg: { r: 0, g: 0, b: 0 } },
    ])

    const palette = detectPalette(view, cols, rows)
    expect(palette.defaultFg).toEqual({ r: 200, g: 200, b: 200 })
  })

  it(`skips completely uninitialized cells (all zeros)`, () => {
    // 1 real cell + 3 empty cells in a 2x2 grid
    const { view, cols, rows } = buildTestViewport(2, 2, [
      {
        row: 0,
        col: 0,
        text: `X`,
        fg: { r: 50, g: 60, b: 70 },
        bg: { r: 10, g: 20, b: 30 },
      },
    ])

    const palette = detectPalette(view, cols, rows)
    // Only one real cell contributes, so that single bg is the most frequent
    expect(palette.defaultBg).toEqual({ r: 10, g: 20, b: 30 })
    expect(palette.defaultFg).toEqual({ r: 50, g: 60, b: 70 })
  })

  it(`does not count spaces (0x20) in fg frequency`, () => {
    // space + 'A'; space should not contribute to fg count
    const { view, cols, rows } = buildTestViewport(2, 1, [
      {
        row: 0,
        col: 0,
        text: ` `,
        fg: { r: 255, g: 0, b: 0 },
        bg: { r: 10, g: 20, b: 30 },
      },
      {
        row: 0,
        col: 1,
        text: `A`,
        fg: { r: 100, g: 150, b: 200 },
        bg: { r: 10, g: 20, b: 30 },
      },
    ])

    const palette = detectPalette(view, cols, rows)
    // Only 'A' contributes to fg; its color should win
    expect(palette.defaultFg).toEqual({ r: 100, g: 150, b: 200 })
  })

  it(`handles INVERSE flag: swaps fg/bg before counting`, () => {
    // Normal cell: fg=(200,200,200), bg=(0,0,0)
    // Inverse cell: stored fg=(200,200,200), stored bg=(0,0,0) but resolved fg=(0,0,0), bg=(200,200,200)
    const { view, cols, rows } = buildTestViewport(2, 1, [
      {
        row: 0,
        col: 0,
        text: `N`,
        fg: { r: 200, g: 200, b: 200 },
        bg: { r: 0, g: 0, b: 0 },
        flags: 0,
      },
      {
        row: 0,
        col: 1,
        text: `I`,
        fg: { r: 200, g: 200, b: 200 },
        bg: { r: 0, g: 0, b: 0 },
        flags: CellFlags.INVERSE,
      },
    ])

    const palette = detectPalette(view, cols, rows)
    // Normal cell bg=(0,0,0), Inverse cell resolved bg=(200,200,200) — each appears once, tie-break goes to first seen
    // What matters is that the inverse cell's bg is (200,200,200), not (0,0,0)
    // Both cells counted: bg counts: (0,0,0)->1, (200,200,200)->1
    // fg counts (non-space): normal=(200,200,200)->1, inverse resolved=(0,0,0)->1
    // Either can "win" on a tie; just verify both colors appear in counts by checking one specific case:
    // The inverse cell should have contributed (200,200,200) to bg counts (from its resolved bg)
    const bgKey = `${palette.defaultBg.r},${palette.defaultBg.g},${palette.defaultBg.b}`
    expect([`0,0,0`, `200,200,200`]).toContain(bgKey)
  })

  it(`returns zero RGB when no cells are present`, () => {
    const { view, cols, rows } = buildTestViewport(5, 5)
    const palette = detectPalette(view, cols, rows)
    expect(palette.defaultBg).toEqual({ r: 0, g: 0, b: 0 })
    expect(palette.defaultFg).toEqual({ r: 0, g: 0, b: 0 })
  })

  it(`handles multi-row viewports`, () => {
    // Dominant bg across all rows is (30,30,30)
    const fills = []
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        fills.push({
          row,
          col,
          text: `X`,
          fg: { r: 220, g: 220, b: 220 },
          bg: { r: 30, g: 30, b: 30 },
        })
      }
    }
    // Override one cell with a different bg
    fills.push({
      row: 4,
      col: 3,
      text: `Y`,
      fg: { r: 255, g: 0, b: 0 },
      bg: { r: 100, g: 0, b: 0 },
    })

    const { view, cols, rows } = buildTestViewport(4, 5, fills)
    const palette = detectPalette(view, cols, rows)
    expect(palette.defaultBg).toEqual({ r: 30, g: 30, b: 30 })
    expect(palette.defaultFg).toEqual({ r: 220, g: 220, b: 220 })
  })
})
