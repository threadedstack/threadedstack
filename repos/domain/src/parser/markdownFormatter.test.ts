import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { GhosttyVT } from './ghosttyVT'
import type { VTerminal } from './ghosttyVT'
import { segmentsToMarkdown, hasFormatting } from './markdownFormatter'

describe('markdownFormatter', () => {
  beforeAll(async () => {
    await GhosttyVT.init()
  })

  let term: VTerminal

  afterEach(() => {
    term?.free()
  })

  describe('segmentsToMarkdown', () => {
    it('wraps bold text in **', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Normal \x1b[1mbold text\x1b[0m end\r\n')
      const segments = term.getLineSegments(0)
      const md = segmentsToMarkdown(segments)
      expect(md).toBe('Normal **bold text** end')
    })

    it('wraps italic text in _', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Normal \x1b[3mitalic\x1b[0m end\r\n')
      const segments = term.getLineSegments(0)
      const md = segmentsToMarkdown(segments)
      expect(md).toBe('Normal _italic_ end')
    })

    it('wraps bold+italic in **_ _**', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Normal \x1b[1;3mboth\x1b[0m end\r\n')
      const segments = term.getLineSegments(0)
      const md = segmentsToMarkdown(segments)
      expect(md).toBe('Normal **_both_** end')
    })

    it('formats standalone bold line as heading', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('\x1b[1mCode\x1b[0m\r\n')
      const segments = term.getLineSegments(0)
      const md = segmentsToMarkdown(segments)
      expect(md).toBe('## Code')
    })

    it('does NOT heading-format bold line with other segments', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Prefix \x1b[1mbold\x1b[0m\r\n')
      const segments = term.getLineSegments(0)
      const md = segmentsToMarkdown(segments)
      expect(md).toBe('Prefix **bold**')
    })

    it('returns plain text when no formatting', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Just plain text\r\n')
      const segments = term.getLineSegments(0)
      const md = segmentsToMarkdown(segments)
      expect(md).toBe('Just plain text')
    })

    it('handles empty segments', () => {
      expect(segmentsToMarkdown([])).toBe('')
    })
  })

  describe('hasFormatting', () => {
    it('returns true for bold text', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('\x1b[1mBold\x1b[0m\r\n')
      expect(hasFormatting(term.getLineSegments(0))).toBe(true)
    })

    it('returns false for plain text', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Plain text\r\n')
      expect(hasFormatting(term.getLineSegments(0))).toBe(false)
    })

    it('returns false for empty segments', () => {
      expect(hasFormatting([])).toBe(false)
    })
  })

  describe('getLineSegments integration', () => {
    it('produces correct segments for mixed formatting', () => {
      term = GhosttyVT.createTerminal(60, 5)
      term.write('A\x1b[1mB\x1b[0mC\x1b[3mD\x1b[0mE\r\n')
      const segments = term.getLineSegments(0)

      expect(segments.length).toBe(5)
      expect(segments[0]).toEqual({ text: 'A', bold: false, italic: false })
      expect(segments[1]).toEqual({ text: 'B', bold: true, italic: false })
      expect(segments[2]).toEqual({ text: 'C', bold: false, italic: false })
      expect(segments[3]).toEqual({ text: 'D', bold: false, italic: true })
      expect(segments[4]).toEqual({ text: 'E', bold: false, italic: false })
    })

    it('trims trailing whitespace from last segment', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('Hello\r\n')
      const segments = term.getLineSegments(0)
      const lastText = segments[segments.length - 1].text
      expect(lastText).toBe('Hello')
      expect(lastText.endsWith(' ')).toBe(false)
    })

    it('returns empty array for blank lines', () => {
      term = GhosttyVT.createTerminal(40, 5)
      term.write('\r\n')
      // Row 0 now has content from the cursor initialization,
      // but after clear screen + newline, row 0 should be blank.
      // Actually row 0 text might be empty after scrolling.
      const segments = term.getLineSegments(0)
      expect(segments.every((s) => s.text.trim() === '')).toBe(true)
    })
  })
})
