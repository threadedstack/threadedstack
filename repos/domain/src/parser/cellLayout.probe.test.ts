/**
 * Tests that verify the ghostty-web WASM cell attribute layout.
 * Each cell is 16 bytes: codepoint(u32) + fg(u32) + flags(u32) + unused(u32).
 *
 * Style flags are in raw[1] (bytes 8-11):
 *   bit 16 = bold   (mask 0x10000)
 *   bit 17 = italic  (mask 0x20000)
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { GhosttyVT } from './ghosttyVT'
import type { VTerminal } from './ghosttyVT'

const BOLD_MASK = 0x10000
const ITALIC_MASK = 0x20000

describe('ghostty cell attribute layout', () => {
  beforeAll(async () => {
    await GhosttyVT.init()
  })

  let term: VTerminal

  afterEach(() => {
    term?.free()
  })

  it('bold flag is bit 16 of raw[1]', () => {
    term = GhosttyVT.createTerminal(20, 5)
    term.write('A\x1b[1mB\x1b[0m\r\n')

    const normal = term.getCellData(0, 0)
    const bold = term.getCellData(0, 1)

    expect(normal.raw[1] & BOLD_MASK).toBe(0)
    expect(bold.raw[1] & BOLD_MASK).toBe(BOLD_MASK)
  })

  it('italic flag is bit 17 of raw[1]', () => {
    term = GhosttyVT.createTerminal(20, 5)
    term.write('A\x1b[3mB\x1b[0m\r\n')

    const normal = term.getCellData(0, 0)
    const italic = term.getCellData(0, 1)

    expect(normal.raw[1] & ITALIC_MASK).toBe(0)
    expect(italic.raw[1] & ITALIC_MASK).toBe(ITALIC_MASK)
  })

  it('bold+italic sets both bits', () => {
    term = GhosttyVT.createTerminal(20, 5)
    term.write('A\x1b[1;3mB\x1b[0m\r\n')

    const normal = term.getCellData(0, 0)
    const both = term.getCellData(0, 1)

    expect(normal.raw[1] & (BOLD_MASK | ITALIC_MASK)).toBe(0)
    expect(both.raw[1] & BOLD_MASK).toBe(BOLD_MASK)
    expect(both.raw[1] & ITALIC_MASK).toBe(ITALIC_MASK)
  })

  it('foreground color changes raw[0], not raw[1]', () => {
    term = GhosttyVT.createTerminal(20, 5)
    term.write('A\x1b[31mB\x1b[0m\r\n')

    const normal = term.getCellData(0, 0)
    const red = term.getCellData(0, 1)

    // Color changes raw[0] (fg field)
    expect(red.raw[0]).not.toBe(normal.raw[0])
    // But not raw[1] (flags field)
    expect(red.raw[1]).toBe(normal.raw[1])
  })
})
