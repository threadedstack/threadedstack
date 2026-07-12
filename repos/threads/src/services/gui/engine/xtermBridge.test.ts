import { describe, it, expect, vi } from 'vitest'
import { VTCellSize } from '@TTH/constants/tokenizer'
import { createBrowserTerminal } from './xtermBridge'

/**
 * term.write()'s dirty-marking callback fires asynchronously (confirmed
 * against the real @xterm/headless Terminal, not synchronously on return),
 * so tests must wait for it before reading getViewport()/getDirtyRows().
 */
const waitForDirty = (terminal: ReturnType<typeof createBrowserTerminal>) =>
  vi.waitFor(() => expect(terminal.getDirtyRows().length).toBeGreaterThan(0))

describe(`xtermBridge (real, unmocked)`, () => {
  it(`packs an RGB truecolor foreground into the viewport buffer at the expected byte offsets`, async () => {
    const terminal = createBrowserTerminal(4, 1)
    terminal.write(`\x1b[38;2;10;20;30mA\x1b[0m`)
    await waitForDirty(terminal)

    const view = terminal.getViewport()
    const offset = 0 * VTCellSize // col 0, row 0

    expect(view.getUint32(offset, true)).toBe(`A`.charCodeAt(0))
    expect(view.getUint8(offset + 4)).toBe(10) // fgR
    expect(view.getUint8(offset + 5)).toBe(20) // fgG
    expect(view.getUint8(offset + 6)).toBe(30) // fgB

    terminal.free()
  })

  it(`packs a palette-indexed foreground into the viewport buffer using the resolved palette RGB`, async () => {
    const terminal = createBrowserTerminal(4, 1)
    // Palette index 1 is the standard ANSI "red" entry, [128, 0, 0] per the
    // 256-color palette xtermBridge builds internally.
    terminal.write(`\x1b[38;5;1mB\x1b[0m`)
    await waitForDirty(terminal)

    const view = terminal.getViewport()
    const offset = 0 * VTCellSize

    expect(view.getUint32(offset, true)).toBe(`B`.charCodeAt(0))
    expect(view.getUint8(offset + 4)).toBe(128) // fgR
    expect(view.getUint8(offset + 5)).toBe(0) // fgG
    expect(view.getUint8(offset + 6)).toBe(0) // fgB

    terminal.free()
  })

  it(`packs an RGB background alongside a bold flag`, async () => {
    const terminal = createBrowserTerminal(4, 1)
    terminal.write(`\x1b[1m\x1b[48;2;5;15;25mC\x1b[0m`)
    await waitForDirty(terminal)

    const view = terminal.getViewport()
    const offset = 0 * VTCellSize

    expect(view.getUint8(offset + 7)).toBe(5) // bgR
    expect(view.getUint8(offset + 8)).toBe(15) // bgG
    expect(view.getUint8(offset + 9)).toBe(25) // bgB
    expect(view.getUint8(offset + 10) & 0x01).toBe(0x01) // BOLD flag set

    terminal.free()
  })

  it(`getDirtyRows reports every row after a write, and markClean clears it`, async () => {
    const terminal = createBrowserTerminal(4, 2)
    terminal.write(`hi`)
    await waitForDirty(terminal)

    expect(terminal.getDirtyRows()).toEqual([0, 1])

    terminal.markClean()
    expect(terminal.getDirtyRows()).toEqual([])

    terminal.free()
  })

  it(`throws once freed, and free() is idempotent`, async () => {
    const terminal = createBrowserTerminal(4, 1)
    terminal.write(`x`)
    await waitForDirty(terminal)

    terminal.free()

    expect(() => terminal.write(`y`)).toThrow(`Terminal has been freed`)
    expect(() => terminal.resize(10, 10)).toThrow(`Terminal has been freed`)
    expect(() => terminal.getDirtyRows()).toThrow(`Terminal has been freed`)
    expect(() => terminal.getViewport()).toThrow(`Terminal has been freed`)
    expect(() => terminal.getCursor()).toThrow(`Terminal has been freed`)
    expect(() => terminal.isAlternateScreen()).toThrow(`Terminal has been freed`)
    expect(() => terminal.markClean()).toThrow(`Terminal has been freed`)

    // Calling free() again must not throw (the _freed guard returns early).
    expect(() => terminal.free()).not.toThrow()
  })
})
