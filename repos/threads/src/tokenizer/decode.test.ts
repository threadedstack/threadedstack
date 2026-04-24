import { describe, it, expect } from 'vitest'
import { GhosttyVTCellSize, CellFlags } from './types'
import { decodeCell, resolveColors, cellOffset, buildTestViewport } from './decode'

describe(`decodeCell`, () => {
  it(`decodes a cell with known ASCII char and RGB colors`, () => {
    const buffer = new ArrayBuffer(GhosttyVTCellSize)
    const view = new DataView(buffer)
    // codepoint: 'A' = 65
    view.setUint32(0, 65, true)
    // fg: (255, 128, 0)
    view.setUint8(4, 255)
    view.setUint8(5, 128)
    view.setUint8(6, 0)
    // bg: (10, 20, 30)
    view.setUint8(7, 10)
    view.setUint8(8, 20)
    view.setUint8(9, 30)
    // flags: BOLD
    view.setUint8(10, CellFlags.BOLD)
    // width: 1
    view.setUint8(11, 1)
    // hyperlink_id: 0
    view.setUint16(12, 0, true)
    // grapheme_len: 1
    view.setUint8(14, 1)

    const cell = decodeCell(view, 0)
    expect(cell.codepoint).toBe(65)
    expect(cell.fg).toEqual({ r: 255, g: 128, b: 0 })
    expect(cell.bg).toEqual({ r: 10, g: 20, b: 30 })
    expect(cell.flags).toBe(CellFlags.BOLD)
    expect(cell.width).toBe(1)
    expect(cell.hyperlinkId).toBe(0)
  })

  it(`decodes a cell with a hyperlink id`, () => {
    const buffer = new ArrayBuffer(GhosttyVTCellSize)
    const view = new DataView(buffer)
    view.setUint32(0, 104, true) // 'h'
    view.setUint8(4, 0)
    view.setUint8(5, 200)
    view.setUint8(6, 50)
    view.setUint8(7, 0)
    view.setUint8(8, 0)
    view.setUint8(9, 0)
    view.setUint8(10, 0)
    view.setUint8(11, 1)
    view.setUint16(12, 42, true) // hyperlink_id = 42
    view.setUint8(14, 1)

    const cell = decodeCell(view, 0)
    expect(cell.codepoint).toBe(104)
    expect(cell.hyperlinkId).toBe(42)
  })

  it(`decodes an empty cell (all zeros)`, () => {
    const buffer = new ArrayBuffer(GhosttyVTCellSize)
    const view = new DataView(buffer)
    // all bytes are 0 by default

    const cell = decodeCell(view, 0)
    expect(cell.codepoint).toBe(0)
    expect(cell.fg).toEqual({ r: 0, g: 0, b: 0 })
    expect(cell.bg).toEqual({ r: 0, g: 0, b: 0 })
    expect(cell.flags).toBe(0)
    expect(cell.width).toBe(0)
    expect(cell.hyperlinkId).toBe(0)
  })

  it(`decodes at a non-zero offset`, () => {
    const buffer = new ArrayBuffer(GhosttyVTCellSize * 3)
    const view = new DataView(buffer)
    const offset = GhosttyVTCellSize * 2
    view.setUint32(offset, 90, true) // 'Z'
    view.setUint8(offset + 4, 1)
    view.setUint8(offset + 5, 2)
    view.setUint8(offset + 6, 3)

    const cell = decodeCell(view, offset)
    expect(cell.codepoint).toBe(90)
    expect(cell.fg).toEqual({ r: 1, g: 2, b: 3 })
  })
})

describe(`resolveColors`, () => {
  it(`returns fg/bg as-is when INVERSE flag is not set`, () => {
    const fg = { r: 255, g: 0, b: 0 }
    const bg = { r: 0, g: 0, b: 255 }
    const cell = {
      codepoint: 65,
      fg,
      bg,
      flags: CellFlags.BOLD,
      width: 1,
      hyperlinkId: 0,
      graphemeLen: 1,
    }
    const result = resolveColors(cell)
    expect(result.fg).toBe(fg)
    expect(result.bg).toBe(bg)
  })

  it(`swaps fg and bg when INVERSE flag is set`, () => {
    const fg = { r: 255, g: 0, b: 0 }
    const bg = { r: 0, g: 0, b: 255 }
    const cell = {
      codepoint: 65,
      fg,
      bg,
      flags: CellFlags.INVERSE,
      width: 1,
      hyperlinkId: 0,
      graphemeLen: 1,
    }
    const result = resolveColors(cell)
    expect(result.fg).toBe(bg)
    expect(result.bg).toBe(fg)
  })

  it(`swaps when INVERSE is combined with other flags`, () => {
    const fg = { r: 10, g: 20, b: 30 }
    const bg = { r: 40, g: 50, b: 60 }
    const cell = {
      codepoint: 65,
      fg,
      bg,
      flags: CellFlags.INVERSE | CellFlags.BOLD,
      width: 1,
      hyperlinkId: 0,
      graphemeLen: 1,
    }
    const result = resolveColors(cell)
    expect(result.fg).toBe(bg)
    expect(result.bg).toBe(fg)
  })
})

describe(`cellOffset`, () => {
  it(`returns 0 for row 0, col 0`, () => {
    expect(cellOffset(0, 0, 80)).toBe(0)
  })

  it(`computes correct offset for col 1 in a 80-col grid`, () => {
    expect(cellOffset(0, 1, 80)).toBe(GhosttyVTCellSize)
  })

  it(`computes correct offset for row 1 in a 80-col grid`, () => {
    expect(cellOffset(1, 0, 80)).toBe(80 * GhosttyVTCellSize)
  })

  it(`computes correct offset for row 2, col 5 in a 40-col grid`, () => {
    expect(cellOffset(2, 5, 40)).toBe((2 * 40 + 5) * GhosttyVTCellSize)
  })
})

describe(`buildTestViewport`, () => {
  it(`creates a zero-filled viewport when no fills given`, () => {
    const { view, cols, rows } = buildTestViewport(10, 5)
    expect(cols).toBe(10)
    expect(rows).toBe(5)
    expect(view.byteLength).toBe(10 * 5 * GhosttyVTCellSize)
    // All bytes should be 0
    for (let i = 0; i < view.byteLength; i++) {
      expect(view.getUint8(i)).toBe(0)
    }
  })

  it(`writes cells at specified positions`, () => {
    const { view, cols } = buildTestViewport(80, 24, [
      {
        row: 0,
        col: 0,
        text: `H`,
        fg: { r: 255, g: 255, b: 255 },
        bg: { r: 0, g: 0, b: 0 },
      },
      { row: 1, col: 5, text: `i`, fg: { r: 100, g: 150, b: 200 } },
    ])

    const cell0 = decodeCell(view, cellOffset(0, 0, cols))
    expect(cell0.codepoint).toBe(`H`.codePointAt(0))
    expect(cell0.fg).toEqual({ r: 255, g: 255, b: 255 })
    expect(cell0.bg).toEqual({ r: 0, g: 0, b: 0 })

    const cell1 = decodeCell(view, cellOffset(1, 5, cols))
    expect(cell1.codepoint).toBe(`i`.codePointAt(0))
    expect(cell1.fg).toEqual({ r: 100, g: 150, b: 200 })
    expect(cell1.bg).toEqual({ r: 0, g: 0, b: 0 })
  })

  it(`writes flags and hyperlinkId`, () => {
    const { view, cols } = buildTestViewport(10, 10, [
      { row: 3, col: 2, text: `X`, flags: CellFlags.INVERSE, hyperlinkId: 7 },
    ])

    const cell = decodeCell(view, cellOffset(3, 2, cols))
    expect(cell.codepoint).toBe(`X`.codePointAt(0))
    expect(cell.flags).toBe(CellFlags.INVERSE)
    expect(cell.hyperlinkId).toBe(7)
  })

  it(`defaults width to 1 and writes correct grapheme_len byte`, () => {
    const { view, cols } = buildTestViewport(5, 5, [{ row: 0, col: 0, text: `A` }])
    const offset = cellOffset(0, 0, cols)
    expect(view.getUint8(offset + 11)).toBe(1) // width
    expect(view.getUint8(offset + 14)).toBe(1) // grapheme_len
  })
})
