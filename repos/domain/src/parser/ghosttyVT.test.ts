import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { GhosttyVT } from './ghosttyVT'
import type { VTerminal } from './ghosttyVT'

describe('GhosttyVT', () => {
  beforeAll(async () => {
    await GhosttyVT.init()
  })

  let term: VTerminal

  afterEach(() => {
    term?.free()
  })

  describe('init', () => {
    it('loads WASM singleton', async () => {
      const instance = await GhosttyVT.init()
      expect(instance).toBeDefined()
    })

    it('returns same instance on subsequent calls', async () => {
      const a = await GhosttyVT.init()
      const b = await GhosttyVT.init()
      expect(a).toBe(b)
    })
  })

  describe('createTerminal', () => {
    it('creates terminal with default dimensions', () => {
      term = GhosttyVT.createTerminal()
      expect(term.cols).toBe(80)
      expect(term.rows).toBe(24)
    })

    it('creates terminal with custom dimensions', () => {
      term = GhosttyVT.createTerminal(120, 40)
      expect(term.cols).toBe(120)
      expect(term.rows).toBe(40)
    })
  })

  describe('write + getLineText', () => {
    it('renders plain text', () => {
      term = GhosttyVT.createTerminal()
      term.write('Hello, World!\r\n')
      expect(term.getLineText(0)).toBe('Hello, World!')
    })

    it('strips ANSI color codes', () => {
      term = GhosttyVT.createTerminal()
      term.write('\x1b[31mRed text\x1b[0m\r\n')
      expect(term.getLineText(0)).toBe('Red text')
    })

    it('handles split escape sequences across writes', () => {
      term = GhosttyVT.createTerminal()
      term.write('\x1b')
      term.write('[31mRed\x1b[0m\r\n')
      expect(term.getLineText(0)).toBe('Red')
    })

    it('handles carriage return overwrites', () => {
      term = GhosttyVT.createTerminal()
      term.write('Loading... 0%')
      term.write('\rLoading... 100%')
      term.write('\r\n')
      expect(term.getLineText(0)).toMatch(/^Loading\.\.\. 100%/)
    })

    it('preserves leading whitespace', () => {
      term = GhosttyVT.createTerminal()
      term.write('    indented\r\n')
      expect(term.getLineText(0)).toBe('    indented')
    })

    it('preserves spaces between words', () => {
      term = GhosttyVT.createTerminal()
      term.write("Let's get started.\r\n")
      expect(term.getLineText(0)).toBe("Let's get started.")
    })

    it('preserves multiple consecutive spaces', () => {
      term = GhosttyVT.createTerminal()
      term.write('a   b\r\n')
      expect(term.getLineText(0)).toBe('a   b')
    })

    it('handles OSC title without visible output', () => {
      term = GhosttyVT.createTerminal()
      term.write('\x1b]0;Title\x07Visible\r\n')
      expect(term.getLineText(0)).toBe('Visible')
    })
  })

  describe('dirty-row tracking', () => {
    it('reports dirty rows after write', () => {
      term = GhosttyVT.createTerminal()
      term.write('Line 1\r\n')
      const dirty = term.getDirtyRows()
      expect(dirty.length).toBeGreaterThan(0)
    })

    it('resets dirty state with markClean', () => {
      term = GhosttyVT.createTerminal()
      term.write('Line 1\r\n')
      term.getDirtyRows() // calls update() internally
      term.markClean()
      const dirty = term.getDirtyRows()
      expect(dirty.length).toBe(0)
    })

    it('detects only modified rows after markClean', () => {
      term = GhosttyVT.createTerminal()
      term.write('Row 0\r\nRow 1\r\nRow 2\r\n')
      term.getDirtyRows()
      term.markClean()

      term.write('\x1b[2;1HModified')
      const dirty = term.getDirtyRows()
      expect(dirty).toContain(1)
    })
  })

  describe('getCursor', () => {
    it('returns cursor position', () => {
      term = GhosttyVT.createTerminal()
      term.write('AB\r\n')
      const cursor = term.getCursor()
      expect(cursor.x).toBe(0)
      expect(cursor.y).toBe(1)
    })
  })

  describe('isAlternateScreen', () => {
    it('detects alternate screen mode', () => {
      term = GhosttyVT.createTerminal()
      expect(term.isAlternateScreen()).toBe(false)
      term.write('\x1b[?1049h')
      expect(term.isAlternateScreen()).toBe(true)
      term.write('\x1b[?1049l')
      expect(term.isAlternateScreen()).toBe(false)
    })
  })

  describe('resize', () => {
    it('updates terminal dimensions', () => {
      term = GhosttyVT.createTerminal()
      term.resize(120, 40)
      expect(term.cols).toBe(120)
      expect(term.rows).toBe(40)
    })
  })
})
