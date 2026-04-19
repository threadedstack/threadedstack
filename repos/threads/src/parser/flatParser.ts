import type {
  TRect,
  RGB,
  TSpan,
  TContentNode,
  TTextLine,
  TSelectItem,
  TSelectList,
} from '../ast'
import type {
  TToken,
  TTextRun,
  THighlightedBlock,
  TWhitespaceGap,
  TLinkSpan,
  TRawSpan,
} from '../tokenizer/types'
import { CellFlags } from '../tokenizer/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a TRawSpan (tokenizer output) to a TSpan (AST leaf). */
export function rawSpanToSpan(raw: TRawSpan): TSpan {
  return {
    type: 'Span',
    text: raw.text,
    fg: raw.fg,
    bg: raw.bg,
    bold: (raw.flags & CellFlags.BOLD) !== 0,
    italic: (raw.flags & CellFlags.ITALIC) !== 0,
    underline: (raw.flags & CellFlags.UNDERLINE) !== 0,
    strikethrough: (raw.flags & CellFlags.STRIKETHROUGH) !== 0,
    faint: (raw.flags & CellFlags.FAINT) !== 0,
    inverse: (raw.flags & CellFlags.INVERSE) !== 0,
  }
}

/** Convert a TTextRun token to a TTextLine AST node. */
export function textRunToTextLine(run: TTextRun): TTextLine {
  return {
    type: 'TextLine',
    bounds: run.bounds,
    children: run.spans.map(rawSpanToSpan),
  }
}

/** Compute the bounding rect of a set of tokens that all have bounds. */
function combineBounds(items: { bounds: TRect }[]): TRect {
  if (items.length === 0) return { top: 0, left: 0, bottom: 0, right: 0 }
  let top = items[0].bounds.top
  let left = items[0].bounds.left
  let bottom = items[0].bounds.bottom
  let right = items[0].bounds.right
  for (let i = 1; i < items.length; i++) {
    const b = items[i].bounds
    if (b.top < top) top = b.top
    if (b.left < left) left = b.left
    if (b.bottom > bottom) bottom = b.bottom
    if (b.right > right) right = b.right
  }
  return { top, left, bottom, right }
}

/** Check if two RGB values are equal. */
function rgbEq(a: RGB, b: RGB): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b
}

/** Get the full text of a text run by concatenating its spans. */
function runText(run: TTextRun): string {
  return run.spans.map((s) => s.text).join('')
}

// ---------------------------------------------------------------------------
// Section splitting - group consecutive non-gap tokens by rows of gaps
// ---------------------------------------------------------------------------

type TSection = {
  textRuns: TTextRun[]
  highlights: THighlightedBlock[]
  links: TLinkSpan[]
}

function splitSections(
  textRuns: TTextRun[],
  highlights: THighlightedBlock[],
  links: TLinkSpan[],
  gaps: TWhitespaceGap[]
): { sections: TSection[]; gaps: TWhitespaceGap[] } {
  if (gaps.length === 0) {
    return {
      sections: [{ textRuns, highlights, links }],
      gaps: [],
    }
  }

  // Sort gaps by row position
  const sortedGaps = [...gaps].sort((a, b) => a.bounds.top - b.bounds.top)

  // All non-gap tokens sorted by top row
  type TokenWithRow = { token: TTextRun | THighlightedBlock | TLinkSpan; topRow: number }
  const allItems: TokenWithRow[] = [
    ...textRuns.map((t) => ({ token: t, topRow: t.bounds.top })),
    ...highlights.map((h) => ({ token: h, topRow: h.bounds.top })),
    ...links.map((l) => ({ token: l, topRow: l.bounds.top })),
  ].sort((a, b) => a.topRow - b.topRow)

  const sections: TSection[] = []
  let currentSection: TSection = { textRuns: [], highlights: [], links: [] }
  let gapIdx = 0

  for (const item of allItems) {
    // Check if we passed a gap boundary
    while (gapIdx < sortedGaps.length && item.topRow > sortedGaps[gapIdx].bounds.bottom) {
      // Flush current section if non-empty
      if (
        currentSection.textRuns.length > 0 ||
        currentSection.highlights.length > 0 ||
        currentSection.links.length > 0
      ) {
        sections.push(currentSection)
        currentSection = { textRuns: [], highlights: [], links: [] }
      }
      gapIdx++
    }

    if (item.token.type === 'TextRun') currentSection.textRuns.push(item.token)
    else if (item.token.type === 'HighlightedBlock')
      currentSection.highlights.push(item.token)
    else if (item.token.type === 'LinkSpan') currentSection.links.push(item.token)
  }

  // Flush last section
  if (
    currentSection.textRuns.length > 0 ||
    currentSection.highlights.length > 0 ||
    currentSection.links.length > 0
  ) {
    sections.push(currentSection)
  }

  return { sections, gaps: sortedGaps }
}

// ---------------------------------------------------------------------------
// Pattern matchers - each returns TContentNode[] or null (no match)
// ---------------------------------------------------------------------------

function trySelectList(section: TSection): TSelectList | null {
  const { textRuns } = section
  if (textRuns.length < 3) return null

  // Must be at consecutive rows
  const sorted = [...textRuns].sort((a, b) => a.bounds.top - b.bounds.top)

  // Check consistent indentation
  const leftCols = sorted.map((r) => r.bounds.left)
  const allSameIndent = leftCols.every((c) => c === leftCols[0])

  let score = 0
  if (allSameIndent) score += 3

  // Check for numbered markers
  const texts = sorted.map(runText)
  const numberedPattern = /^\d+[.)]\s/
  const numberedCount = texts.filter((t) => numberedPattern.test(t)).length
  if (numberedCount === texts.length) score += 3

  // Check for arrow markers — require genuine selection list structure:
  // - at least 1 arrow-marked item and 2+ unmarked items
  // - items must have consistent indentation (allSameIndent)
  // - items should have similar line lengths (not wildly different)
  // Filter out runs that are purely separator/decoration characters.
  const arrowPattern = /^[>\u276F\u203A\u2192]\s/
  const separatorPattern = /^[─━╌╍┄┈═╼╾\-=_]+$/
  const meaningfulTexts = texts.filter((t) => !separatorPattern.test(t.trim()))
  const arrowCount = meaningfulTexts.filter((t) => arrowPattern.test(t)).length
  const nonArrowCount = meaningfulTexts.length - arrowCount
  if (arrowCount > 0 && nonArrowCount >= 2 && allSameIndent) {
    // Check that items have similar line lengths (max/min ratio < 4)
    // to filter out mixed prompt + notification text
    const lengths = meaningfulTexts.map((t) => t.trim().length).filter((l) => l > 0)
    const maxLen = Math.max(...lengths)
    const minLen = Math.min(...lengths)
    if (minLen > 0 && maxLen / minLen < 4) {
      score += 3
    }
  }

  // Check sequential numbering
  const numbers = texts
    .map((t) => {
      const m = t.match(/^(\d+)[.)]\s/)
      return m ? Number.parseInt(m[1], 10) : null
    })
    .filter((n): n is number => n !== null)
  if (numbers.length >= 2) {
    let sequential = true
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i - 1] + 1) {
        sequential = false
        break
      }
    }
    if (sequential) score += 2
  }

  // Check for exactly one highlighted row
  const { highlights } = section
  if (highlights.length === 1) score += 3

  if (score < 5) return null

  // Determine style
  let style: TSelectList['style'] = 'highlighted'
  if (arrowCount > 0) style = 'arrow'
  else if (numberedCount === texts.length) style = 'numbered'

  // Find selected index
  let selectedIndex = 0
  if (highlights.length === 1) {
    const hlRow = highlights[0].bounds.top
    const idx = sorted.findIndex((r) => r.bounds.top === hlRow)
    if (idx >= 0) selectedIndex = idx
  } else if (arrowCount > 0) {
    const idx = texts.findIndex((t) => arrowPattern.test(t))
    if (idx >= 0) selectedIndex = idx
  }

  const children: TSelectItem[] = sorted.map((run, i) => ({
    type: 'SelectItem' as const,
    bounds: run.bounds,
    selected: i === selectedIndex,
    index: i,
    children: run.spans.map(rawSpanToSpan),
  }))

  return {
    type: 'SelectList',
    bounds: combineBounds(sorted),
    selectedIndex,
    style,
    children,
  }
}

function tryTable(section: TSection): TContentNode | null {
  const { textRuns } = section
  if (textRuns.length < 3) return null

  const sorted = [...textRuns].sort((a, b) => a.bounds.top - b.bounds.top)
  const texts = sorted.map(runText)

  // Find column separator positions (pipe, box-draw verticals)
  const sepChars = /[\u2502\u2503|]/g
  const sepPositionsByRow: number[][] = texts.map((t) => {
    const positions: number[] = []
    let m: RegExpExecArray | null = null
    // Reset lastIndex for each row
    sepChars.lastIndex = 0
    const localRe = new RegExp(sepChars.source, 'g')
    while ((m = localRe.exec(t)) !== null) {
      positions.push(m.index)
    }
    return positions
  })

  // Find consistent column positions (appearing in >60% of rows at the same index)
  const threshold = Math.ceil(texts.length * 0.6)
  const positionCounts = new Map<number, number>()
  for (const positions of sepPositionsByRow) {
    for (const pos of positions) {
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1)
    }
  }

  const consistentPositions = [...positionCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([pos]) => pos)
    .sort((a, b) => a - b)

  if (consistentPositions.length < 2) return null

  // First row bold/underline -> header
  const firstRunSpans = sorted[0].spans
  const isHeader = firstRunSpans.some(
    (s) => (s.flags & CellFlags.BOLD) !== 0 || (s.flags & CellFlags.UNDERLINE) !== 0
  )

  const children = sorted.map((run, rowIdx) => {
    const text = runText(run)
    // Split text by separator positions
    const cellTexts: string[] = []
    let prev = 0
    for (const pos of consistentPositions) {
      if (pos <= text.length) {
        cellTexts.push(text.slice(prev, pos).trim())
        prev = pos + 1
      }
    }
    cellTexts.push(text.slice(prev).trim())

    const cells: TSpan[][] = cellTexts.map((ct) => [
      {
        type: 'Span' as const,
        text: ct,
        fg: run.spans[0]?.fg || { r: 255, g: 255, b: 255 },
        bg: run.spans[0]?.bg || { r: 0, g: 0, b: 0 },
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        faint: false,
        inverse: false,
      },
    ])

    return {
      type: 'TableRow' as const,
      bounds: run.bounds,
      isHeader: rowIdx === 0 && isHeader,
      cells,
    }
  })

  return {
    type: 'Table' as const,
    bounds: combineBounds(sorted),
    hasHeader: isHeader,
    children,
  }
}

function tryDiffBlock(section: TSection): TContentNode | null {
  const { textRuns } = section
  if (textRuns.length < 2) return null

  const sorted = [...textRuns].sort((a, b) => a.bounds.top - b.bounds.top)

  // Check for +/- prefix or green/red fg coloring
  let diffCount = 0
  for (const run of sorted) {
    const text = runText(run)
    const trimmed = text.trimStart()
    const hasDiffPrefix = trimmed.startsWith('+') || trimmed.startsWith('-')
    const hasGreenFg = run.spans.some((s) => s.fg.g > 150 && s.fg.r < 100 && s.fg.b < 100)
    const hasRedFg = run.spans.some((s) => s.fg.r > 150 && s.fg.g < 100 && s.fg.b < 100)
    if (hasDiffPrefix || hasGreenFg || hasRedFg) diffCount++
  }

  // Need majority of lines to be diff lines
  if (diffCount < sorted.length * 0.5) return null

  return {
    type: 'DiffBlock',
    bounds: combineBounds(sorted),
    children: sorted.map(textRunToTextLine),
  }
}

function tryConfirm(section: TSection): TContentNode | null {
  const { textRuns, highlights } = section
  if (textRuns.length === 0) return null

  const fullText = textRuns.map(runText).join(' ')

  // Pattern: (y/n), [Y/n], (yes/no), etc.
  const ynMatch = fullText.match(
    /[\[(](y(?:es)?)\s*[/|]\s*(n(?:o)?)\s*[\])]|[\[(](n(?:o)?)\s*[/|]\s*(y(?:es)?)\s*[\])]/i
  )
  if (ynMatch) {
    const opt1 = (ynMatch[1] || ynMatch[4] || 'y').toLowerCase()
    const opt2 = (ynMatch[2] || ynMatch[3] || 'n').toLowerCase()
    const idx = ynMatch.index || 0
    const question = fullText.slice(0, idx).trim()
    // Determine which is focused - uppercase letter means focused
    const rawFull = ynMatch[0]
    const focusedIndex: 0 | 1 = rawFull.includes(opt1.toUpperCase()) ? 0 : 1
    return {
      type: 'Confirm',
      bounds: combineBounds(textRuns),
      question: question || fullText,
      options: [opt1, opt2] as [string, string],
      focusedIndex,
    }
  }

  // Pattern: exactly 2 small highlighted blocks
  if (highlights.length === 2) {
    const allSmall = highlights.every((h) => h.shape === 'small')
    if (allSmall) {
      const question = textRuns.map(runText).join(' ').trim()
      return {
        type: 'Confirm',
        bounds: combineBounds([...textRuns, ...highlights]),
        question,
        options: ['yes', 'no'],
        focusedIndex: 0,
      }
    }
  }

  return null
}

function tryTextInput(
  section: TSection,
  cursor: { x: number; y: number; visible: boolean }
): TContentNode | null {
  if (!cursor.visible) return null

  const { textRuns } = section
  if (textRuns.length === 0) return null

  // Cursor must be within a row covered by this section
  const cursorRow = cursor.y
  const inSection = textRuns.some(
    (r) => r.bounds.top <= cursorRow && r.bounds.bottom >= cursorRow
  )
  if (!inSection) return null

  // Find the run on the cursor's row
  const cursorRun = textRuns.find(
    (r) => r.bounds.top <= cursorRow && r.bounds.bottom >= cursorRow
  )
  if (!cursorRun) return null

  const text = runText(cursorRun)
  const promptChars = ['>', '$', '%', '#', ':', '?', '\u276F', '\u203A']

  // Find a prompt char to the left of the cursor
  const cursorCol = cursor.x
  const runStartCol = cursorRun.bounds.left
  const relativeCol = cursorCol - runStartCol

  let promptEndIdx = -1
  for (let i = Math.min(relativeCol, text.length) - 1; i >= 0; i--) {
    if (promptChars.includes(text[i])) {
      promptEndIdx = i
      break
    }
  }

  if (promptEndIdx < 0) return null

  // Everything up to and including the prompt char is the prompt
  const prompt = text.slice(0, promptEndIdx + 1).trimStart()
  // Skip whitespace after prompt char
  let valueStart = promptEndIdx + 1
  while (valueStart < text.length && text[valueStart] === ' ') valueStart++
  const value = text.slice(valueStart)
  const cursorOffset = Math.max(0, relativeCol - valueStart)

  return {
    type: 'TextInput',
    bounds: combineBounds(textRuns),
    prompt,
    value,
    cursorOffset,
  }
}

function tryActionTarget(section: TSection, defaultBg: RGB): TContentNode[] | null {
  const { highlights } = section
  if (highlights.length === 0) return null

  // Only small highlighted blocks
  const small = highlights.filter((h) => h.shape === 'small')
  if (small.length === 0) return null

  const results: TContentNode[] = []

  for (const hl of small) {
    let score = 0

    // Non-default bg
    if (!rgbEq(hl.color, defaultBg)) score += 2

    // Short text check: width <= 20
    const width = hl.bounds.right - hl.bounds.left + 1
    if (width <= 20) score += 1

    // Peer group: other small highlights nearby
    if (small.length > 1) score += 2

    // Hotkey hint: look for a single char in brackets or parentheses in nearby text runs
    const nearbyRuns = section.textRuns.filter(
      (r) =>
        Math.abs(r.bounds.top - hl.bounds.top) <= 1 &&
        Math.abs(r.bounds.left - hl.bounds.right) <= 3
    )
    let hotkey: string | undefined
    for (const run of nearbyRuns) {
      const text = runText(run)
      const hkMatch = text.match(/[\[(]([a-zA-Z0-9])[\])]/)
      if (hkMatch) {
        hotkey = hkMatch[1]
        score += 2
        break
      }
    }

    if (score < 3) continue

    const label =
      section.textRuns
        .filter(
          (r) =>
            r.bounds.top >= hl.bounds.top &&
            r.bounds.bottom <= hl.bounds.bottom &&
            r.bounds.left >= hl.bounds.left &&
            r.bounds.right <= hl.bounds.right
        )
        .map(runText)
        .join('')
        .trim() || 'button'

    const children: TSpan[] = [
      {
        type: 'Span',
        text: label,
        fg: { r: 255, g: 255, b: 255 },
        bg: hl.color,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        faint: false,
        inverse: false,
      },
    ]

    const node: TContentNode = {
      type: 'ActionTarget',
      bounds: hl.bounds,
      label,
      focused: false,
      children,
      ...(hotkey !== undefined ? { hotkey } : {}),
    }
    results.push(node)
  }

  return results.length > 0 ? results : null
}

function tryStatusBar(section: TSection, scopeBounds: TRect): TContentNode | null {
  const { highlights } = section
  if (highlights.length === 0) return null

  // Look for a full-width highlighted block on the last row of the scope
  const lastRow = scopeBounds.bottom
  const fullWidth = highlights.find(
    (h) => h.shape === 'full-width' && h.bounds.top === lastRow
  )
  if (!fullWidth) return null

  // Build segments from any text runs on the same row
  const rowRuns = section.textRuns.filter((r) => r.bounds.top === lastRow)

  const segments: TSpan[][] =
    rowRuns.length > 0
      ? rowRuns.map((run) => run.spans.map(rawSpanToSpan))
      : [
          [
            {
              type: 'Span',
              text: '',
              fg: { r: 255, g: 255, b: 255 },
              bg: fullWidth.color,
              bold: false,
              italic: false,
              underline: false,
              strikethrough: false,
              faint: false,
              inverse: false,
            },
          ],
        ]

  return {
    type: 'StatusBar',
    bounds: fullWidth.bounds,
    segments,
  }
}

function tryLink(section: TSection): TContentNode[] | null {
  const { links } = section
  if (links.length === 0) return null

  return links.map((lk) => ({
    type: 'Link' as const,
    bounds: lk.bounds,
    hyperlinkId: lk.hyperlinkId,
    children: [
      {
        type: 'Span' as const,
        text: lk.text,
        fg: { r: 100, g: 149, b: 237 },
        bg: { r: 0, g: 0, b: 0 },
        bold: false,
        italic: false,
        underline: true,
        strikethrough: false,
        faint: false,
        inverse: false,
      },
    ],
  }))
}

function buildSeparator(gap: TWhitespaceGap): TContentNode {
  return {
    type: 'Separator',
    bounds: gap.bounds,
    style: gap.height > 1 ? 'blank' : 'line',
  }
}

function buildTextLines(section: TSection): TContentNode[] {
  return section.textRuns
    .sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left)
    .map(textRunToTextLine)
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const DefaultBg: RGB = { r: 0, g: 0, b: 0 }

/**
 * Parse flat (non-scoped) token content into AST content nodes.
 *
 * Tokens are split into sections by WhitespaceGap boundaries, then each
 * section is tested against 10 patterns in specificity order.
 */
export function parseFlatContent(
  tokens: TToken[],
  scopeBounds: TRect,
  cursor: { x: number; y: number; visible: boolean }
): TContentNode[] {
  // Classify tokens by type
  const textRuns: TTextRun[] = []
  const highlights: THighlightedBlock[] = []
  const gaps: TWhitespaceGap[] = []
  const links: TLinkSpan[] = []

  for (const t of tokens) {
    switch (t.type) {
      case 'TextRun':
        textRuns.push(t)
        break
      case 'HighlightedBlock':
        highlights.push(t)
        break
      case 'WhitespaceGap':
        gaps.push(t)
        break
      case 'LinkSpan':
        links.push(t)
        break
    }
  }

  // Split into sections
  const { sections, gaps: sortedGaps } = splitSections(textRuns, highlights, links, gaps)

  const result: TContentNode[] = []
  let gapIdx = 0

  for (let secIdx = 0; secIdx < sections.length; secIdx++) {
    const section = sections[secIdx]

    // Insert separator for gaps between sections
    if (secIdx > 0 && gapIdx < sortedGaps.length) {
      result.push(buildSeparator(sortedGaps[gapIdx]))
      gapIdx++
    }

    // Try patterns in specificity order (first match wins)
    const selectList = trySelectList(section)
    if (selectList) {
      result.push(selectList)
      continue
    }

    const table = tryTable(section)
    if (table) {
      result.push(table)
      continue
    }

    const diff = tryDiffBlock(section)
    if (diff) {
      result.push(diff)
      continue
    }

    const confirmNode = tryConfirm(section)
    if (confirmNode) {
      result.push(confirmNode)
      continue
    }

    const input = tryTextInput(section, cursor)
    if (input) {
      result.push(input)
      continue
    }

    const actions = tryActionTarget(section, DefaultBg)
    if (actions) {
      result.push(...actions)
      continue
    }

    const statusBar = tryStatusBar(section, scopeBounds)
    if (statusBar) {
      result.push(statusBar)
      continue
    }

    const linkNodes = tryLink(section)
    if (linkNodes) {
      result.push(...linkNodes)
      continue
    }

    // Fallback: TextLine
    result.push(...buildTextLines(section))
  }

  return result
}
