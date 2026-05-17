import type { TTextSegment } from '@TDM/types'

/**
 * Convert a line's attributed text segments into a markdown-formatted string.
 *
 * - Bold segments → `**text**`
 * - Italic segments → `_text_`
 * - Bold+italic → `**_text_**`
 * - Plain segments → `text`
 *
 * Only applies markdown wrappers when the segment contains non-whitespace
 * content, to avoid wrapping bare spaces in formatting markers.
 *
 * Additionally detects "standalone bold lines" (a single bold segment that
 * spans the whole line) and formats them as markdown headings (`## text`),
 * since TUI apps commonly use ANSI bold for section headers.
 */
export function segmentsToMarkdown(segments: TTextSegment[]): string {
  if (segments.length === 0) return ''

  // If the entire line is a single bold segment with no leading whitespace,
  // treat it as a heading. This matches how Claude Code renders section
  // headers ("Code", "Research & Explore", etc.) as standalone bold lines.
  if (
    segments.length === 1 &&
    segments[0].bold &&
    !segments[0].italic &&
    segments[0].text.trim().length > 0 &&
    !segments[0].text.startsWith(' ') &&
    segments[0].text.length <= 80
  ) {
    return `## ${segments[0].text.trim()}`
  }

  let result = ''
  for (const seg of segments) {
    const hasContent = seg.text.trim().length > 0
    if (!hasContent) {
      result += seg.text
      continue
    }

    if (seg.bold && seg.italic) {
      result += `**_${seg.text}_**`
    } else if (seg.bold) {
      result += `**${seg.text}**`
    } else if (seg.italic) {
      result += `_${seg.text}_`
    } else {
      result += seg.text
    }
  }

  return result
}

/**
 * Check if segments contain any formatting (bold or italic).
 * Returns false for plain-text-only lines, allowing callers to
 * skip markdown formatting when unnecessary.
 */
export function hasFormatting(segments: TTextSegment[]): boolean {
  return segments.some((s) => (s.bold || s.italic) && s.text.trim().length > 0)
}
