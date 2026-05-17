import type { TTextSegment } from '@TDM/types'
import { describe, it, expect } from 'vitest'
import { segmentsToMarkdown, hasFormatting } from './markdownFormatter'

const seg = (text: string, bold = false, italic = false): TTextSegment => ({
  text,
  bold,
  italic,
})

describe('markdownFormatter', () => {
  describe('segmentsToMarkdown', () => {
    it('wraps bold text in **', () => {
      const segments = [seg('Normal '), seg('bold text', true), seg(' end')]
      expect(segmentsToMarkdown(segments)).toBe('Normal **bold text** end')
    })

    it('wraps italic text in _', () => {
      const segments = [seg('Normal '), seg('italic', false, true), seg(' end')]
      expect(segmentsToMarkdown(segments)).toBe('Normal _italic_ end')
    })

    it('wraps bold+italic in **_ _**', () => {
      const segments = [seg('Normal '), seg('both', true, true), seg(' end')]
      expect(segmentsToMarkdown(segments)).toBe('Normal **_both_** end')
    })

    it('formats standalone bold line as heading', () => {
      const segments = [seg('Code', true)]
      expect(segmentsToMarkdown(segments)).toBe('## Code')
    })

    it('does NOT heading-format bold line with other segments', () => {
      const segments = [seg('Prefix '), seg('bold', true)]
      expect(segmentsToMarkdown(segments)).toBe('Prefix **bold**')
    })

    it('returns plain text when no formatting', () => {
      const segments = [seg('Just plain text')]
      expect(segmentsToMarkdown(segments)).toBe('Just plain text')
    })

    it('handles empty segments', () => {
      expect(segmentsToMarkdown([])).toBe('')
    })

    it('does not wrap whitespace-only segments in formatting', () => {
      const segments = [seg('hello'), seg('   ', true), seg('world')]
      expect(segmentsToMarkdown(segments)).toBe('hello   world')
    })

    it('does not heading-format bold lines longer than 80 chars', () => {
      const longText = 'A'.repeat(81)
      const segments = [seg(longText, true)]
      expect(segmentsToMarkdown(segments)).toBe(`**${longText}**`)
    })

    it('does not heading-format bold+italic lines', () => {
      const segments = [seg('Title', true, true)]
      expect(segmentsToMarkdown(segments)).toBe('**_Title_**')
    })

    it('does not heading-format bold lines with leading spaces', () => {
      const segments = [seg(' Indented', true)]
      expect(segmentsToMarkdown(segments)).toBe('** Indented**')
    })
  })

  describe('hasFormatting', () => {
    it('returns true for bold text', () => {
      expect(hasFormatting([seg('Bold', true)])).toBe(true)
    })

    it('returns true for italic text', () => {
      expect(hasFormatting([seg('Italic', false, true)])).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(hasFormatting([seg('Plain text')])).toBe(false)
    })

    it('returns false for empty segments', () => {
      expect(hasFormatting([])).toBe(false)
    })

    it('returns false for whitespace-only bold segments', () => {
      expect(hasFormatting([seg('   ', true)])).toBe(false)
    })
  })
})
