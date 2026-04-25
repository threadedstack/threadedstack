import type {
  TRect,
  TToken,
  TTextRun,
  TRawSpan,
  TLinkSpan,
  TWhitespaceGap,
  THighlightedBlock,
} from '@TTH/types'

import { describe, it, expect } from 'vitest'
import { CellFlags } from '@TTH/constants/tokenizer'
import {
  rawSpanToSpan,
  parseFlatContent,
  textRunToTextLine,
} from '@TTH/services/gui/parser/flatParser'

const defaultCursor = { x: 0, y: 0, visible: false }
const defaultBounds: TRect = { top: 0, left: 0, bottom: 23, right: 79 }

function makeTextRun(
  row: number,
  col: number,
  text: string,
  opts?: Partial<TRawSpan>
): TTextRun {
  return {
    type: `TextRun`,
    bounds: { top: row, left: col, bottom: row, right: col + text.length - 1 },
    spans: [
      {
        text,
        fg: opts?.fg || { r: 200, g: 200, b: 200 },
        bg: opts?.bg || { r: 0, g: 0, b: 0 },
        flags: opts?.flags || 0,
      },
    ],
  }
}

function makeGap(row: number, height: number): TWhitespaceGap {
  return {
    type: `WhitespaceGap`,
    bounds: { top: row, left: 0, bottom: row + height - 1, right: 79 },
    height,
  }
}

function makeHighlight(
  row: number,
  col: number,
  width: number,
  shape: THighlightedBlock['shape'] = `small`,
  color = { r: 100, g: 100, b: 255 }
): THighlightedBlock {
  return {
    type: `HighlightedBlock`,
    bounds: { top: row, left: col, bottom: row, right: col + width - 1 },
    color,
    shape,
  }
}

function makeLinkSpan(row: number, col: number, text: string, id: number): TLinkSpan {
  return {
    type: `LinkSpan`,
    bounds: { top: row, left: col, bottom: row, right: col + text.length - 1 },
    hyperlinkId: id,
    text,
  }
}

describe(`rawSpanToSpan`, () => {
  it(`converts flags bitmask to boolean fields`, () => {
    const raw: TRawSpan = {
      text: `hello`,
      fg: { r: 255, g: 255, b: 255 },
      bg: { r: 0, g: 0, b: 0 },
      flags: CellFlags.BOLD | CellFlags.UNDERLINE,
    }
    const span = rawSpanToSpan(raw)
    expect(span.type).toBe(`Span`)
    expect(span.text).toBe(`hello`)
    expect(span.bold).toBe(true)
    expect(span.underline).toBe(true)
    expect(span.italic).toBe(false)
    expect(span.strikethrough).toBe(false)
    expect(span.faint).toBe(false)
    expect(span.inverse).toBe(false)
  })

  it(`handles zero flags`, () => {
    const raw: TRawSpan = {
      text: `x`,
      fg: { r: 0, g: 0, b: 0 },
      bg: { r: 0, g: 0, b: 0 },
      flags: 0,
    }
    const span = rawSpanToSpan(raw)
    expect(span.bold).toBe(false)
    expect(span.italic).toBe(false)
    expect(span.faint).toBe(false)
  })
})

describe(`textRunToTextLine`, () => {
  it(`converts a TextRun to a TextLine with Span children`, () => {
    const run = makeTextRun(3, 5, `hello world`)
    const line = textRunToTextLine(run)
    expect(line.type).toBe(`TextLine`)
    expect(line.bounds).toEqual(run.bounds)
    expect(line.children).toHaveLength(1)
    expect(line.children[0].type).toBe(`Span`)
    expect(line.children[0].text).toBe(`hello world`)
  })
})

describe(`parseFlatContent`, () => {
  describe(`plain text fallback (TextLine)`, () => {
    it(`converts a single TextRun to a TextLine`, () => {
      const tokens: TToken[] = [makeTextRun(0, 0, `Hello world`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`TextLine`)
    })

    it(`converts multiple TextRuns on different rows to TextLines`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Line one`),
        makeTextRun(1, 0, `Line two`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(2)
      expect(result.every((n) => n.type === `TextLine`)).toBe(true)
    })
  })

  describe(`SelectList pattern`, () => {
    it(`detects a numbered list as SelectList`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 2, `1. First item`),
        makeTextRun(1, 2, `2. Second item`),
        makeTextRun(2, 2, `3. Third item`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`SelectList`)
      const list = result[0] as any
      expect(list.style).toBe(`numbered`)
      expect(list.children).toHaveLength(3)
    })

    it(`detects arrow markers as SelectList`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 2, `> Option A`),
        makeTextRun(1, 2, `  Option B`),
        makeTextRun(2, 2, `  Option C`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`SelectList`)
      const list = result[0] as any
      expect(list.style).toBe(`arrow`)
      expect(list.selectedIndex).toBe(0)
    })

    it(`does not match fewer than 3 items`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 2, `1. First`),
        makeTextRun(1, 2, `2. Second`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result.every((n) => n.type !== `SelectList`)).toBe(true)
    })
  })

  describe(`DiffBlock pattern`, () => {
    it(`detects diff lines with +/- prefixes`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `+ added line one`),
        makeTextRun(1, 0, `- removed line two`),
        makeTextRun(2, 0, `+ added line three`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`DiffBlock`)
      const diff = result[0] as any
      expect(diff.children).toHaveLength(3)
      expect(diff.children[0].type).toBe(`TextLine`)
    })

    it(`detects diff by green/red coloring`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `added line`, { fg: { r: 50, g: 200, b: 50 } }),
        makeTextRun(1, 0, `removed line`, { fg: { r: 200, g: 50, b: 50 } }),
        makeTextRun(2, 0, `another add`, { fg: { r: 50, g: 200, b: 50 } }),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`DiffBlock`)
    })
  })

  describe(`StatusBar pattern`, () => {
    it(`detects full-width highlight on last row as StatusBar`, () => {
      const scopeBounds: TRect = { top: 0, left: 0, bottom: 5, right: 79 }
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Some content`),
        makeHighlight(5, 0, 80, `full-width`, { r: 0, g: 100, b: 200 }),
        makeTextRun(5, 0, `Status text`),
      ]
      const result = parseFlatContent(tokens, scopeBounds, defaultCursor)
      const statusBars = result.filter((n) => n.type === `StatusBar`)
      expect(statusBars).toHaveLength(1)
    })

    it(`does not match full-width highlight on non-last row`, () => {
      const scopeBounds: TRect = { top: 0, left: 0, bottom: 10, right: 79 }
      const tokens: TToken[] = [
        makeHighlight(5, 0, 80, `full-width`, { r: 0, g: 100, b: 200 }),
      ]
      const result = parseFlatContent(tokens, scopeBounds, defaultCursor)
      const statusBars = result.filter((n) => n.type === `StatusBar`)
      expect(statusBars).toHaveLength(0)
    })
  })

  describe(`Separator pattern`, () => {
    it(`inserts Separator nodes for WhitespaceGaps between sections`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Section one`),
        makeGap(1, 2),
        makeTextRun(3, 0, `Section two`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const seps = result.filter((n) => n.type === `Separator`)
      expect(seps.length).toBeGreaterThanOrEqual(1)
    })

    it(`uses "blank" style for multi-row gaps`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Section one`),
        makeGap(1, 3),
        makeTextRun(4, 0, `Section two`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const seps = result.filter((n) => n.type === `Separator`)
      expect(seps.length).toBeGreaterThanOrEqual(1)
      expect((seps[0] as any).style).toBe(`blank`)
    })

    it(`uses "line" style for single-row gaps`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Section one`),
        makeGap(1, 1),
        makeTextRun(2, 0, `Section two`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const seps = result.filter((n) => n.type === `Separator`)
      expect(seps.length).toBeGreaterThanOrEqual(1)
      expect((seps[0] as any).style).toBe(`line`)
    })
  })

  describe(`Link pattern`, () => {
    it(`converts LinkSpan tokens to Link nodes`, () => {
      const tokens: TToken[] = [makeLinkSpan(0, 0, `click here`, 42)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`Link`)
      const link = result[0] as any
      expect(link.hyperlinkId).toBe(42)
      expect(link.children[0].text).toBe(`click here`)
      expect(link.children[0].underline).toBe(true)
    })
  })

  describe(`TextInput pattern`, () => {
    it(`detects text input when cursor is visible near a prompt char`, () => {
      const cursor = { x: 5, y: 0, visible: true }
      const tokens: TToken[] = [makeTextRun(0, 0, `> hello`)]
      const result = parseFlatContent(tokens, defaultBounds, cursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`TextInput`)
      const input = result[0] as any
      expect(input.prompt).toBe(`>`)
      expect(input.value).toBe(`hello`)
    })

    it(`does not detect text input when cursor is not visible`, () => {
      const cursor = { x: 5, y: 0, visible: false }
      const tokens: TToken[] = [makeTextRun(0, 0, `> hello`)]
      const result = parseFlatContent(tokens, defaultBounds, cursor)
      expect(result[0].type).not.toBe(`TextInput`)
    })
  })

  describe(`Confirm pattern`, () => {
    it(`detects (y/n) confirmation prompt`, () => {
      const tokens: TToken[] = [makeTextRun(0, 0, `Continue? (y/n)`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`Confirm`)
      const confirm = result[0] as any
      expect(confirm.question).toBe(`Continue?`)
      expect(confirm.options).toEqual([`y`, `n`])
    })

    it(`detects [Y/n] confirmation prompt`, () => {
      const tokens: TToken[] = [makeTextRun(0, 0, `Proceed? [Y/n]`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(`Confirm`)
    })

    it(`[Y/n] sets focusedIndex to 0 (Y is uppercase)`, () => {
      const tokens: TToken[] = [makeTextRun(0, 0, `Save changes? [Y/n]`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      const confirm = result[0] as any
      expect(confirm.type).toBe(`Confirm`)
      expect(confirm.focusedIndex).toBe(0)
      expect(confirm.options).toEqual([`y`, `n`])
      expect(confirm.question).toBe(`Save changes?`)
    })

    it(`[y/N] sets focusedIndex to 1 (N is uppercase)`, () => {
      const tokens: TToken[] = [makeTextRun(0, 0, `Delete all? [y/N]`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      const confirm = result[0] as any
      expect(confirm.type).toBe(`Confirm`)
      expect(confirm.focusedIndex).toBe(1)
      expect(confirm.options).toEqual([`y`, `n`])
      expect(confirm.question).toBe(`Delete all?`)
    })

    it(`detects two small highlighted blocks as Confirm buttons`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Are you sure?`),
        makeHighlight(1, 0, 6, `small`, { r: 0, g: 100, b: 200 }),
        makeHighlight(1, 10, 6, `small`, { r: 100, g: 100, b: 100 }),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const confirms = result.filter((n) => n.type === `Confirm`)
      expect(confirms).toHaveLength(1)
      const confirm = confirms[0] as any
      expect(confirm.options).toEqual([`yes`, `no`])
      expect(confirm.focusedIndex).toBe(0)
    })

    it(`(yes/no) long-form options work`, () => {
      const tokens: TToken[] = [makeTextRun(0, 0, `Continue? (yes/no)`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      expect(result).toHaveLength(1)
      const confirm = result[0] as any
      expect(confirm.type).toBe(`Confirm`)
      expect(confirm.options).toEqual([`yes`, `no`])
      expect(confirm.question).toBe(`Continue?`)
    })

    it(`no highlight defaults focusedIndex based on case`, () => {
      // Both lowercase -> opt1.toUpperCase() not found -> focusedIndex:1
      const tokens: TToken[] = [makeTextRun(0, 0, `Overwrite? (y/n)`)]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const confirm = result[0] as any
      expect(confirm.type).toBe(`Confirm`)
      // Neither letter is uppercase in the raw match -> focusedIndex:1
      expect(confirm.focusedIndex).toBe(1)
    })
  })

  describe(`ActionTarget pattern`, () => {
    it(`detects small highlighted blocks with peer groups as action targets`, () => {
      const tokens: TToken[] = [
        makeHighlight(0, 0, 8, `small`, { r: 50, g: 50, b: 200 }),
        makeHighlight(0, 10, 8, `small`, { r: 50, g: 50, b: 200 }),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const actions = result.filter((n) => n.type === `ActionTarget`)
      expect(actions.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe(`Table pattern`, () => {
    it(`detects a 3-column table with pipe separators`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Name     | Age | City`),
        makeTextRun(1, 0, `Alice    | 30  | NYC`),
        makeTextRun(2, 0, `Bob      | 25  | LA`),
        makeTextRun(3, 0, `Charlie  | 40  | SF`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(1)
      const table = tables[0] as any
      expect(table.children).toHaveLength(4)
      // Each row should have cells split by pipe positions
      expect(table.children[0].cells.length).toBeGreaterThanOrEqual(3)
    })

    it(`detects header row when first row is bold`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Name     | Age | City`, { flags: CellFlags.BOLD }),
        makeTextRun(1, 0, `Alice    | 30  | NYC`),
        makeTextRun(2, 0, `Bob      | 25  | LA`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(1)
      const table = tables[0] as any
      expect(table.hasHeader).toBe(true)
      expect(table.children[0].isHeader).toBe(true)
      expect(table.children[1].isHeader).toBe(false)
    })

    it(`does not detect table without header flag when first row is plain`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Name     | Age | City`),
        makeTextRun(1, 0, `Alice    | 30  | NYC`),
        makeTextRun(2, 0, `Bob      | 25  | LA`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(1)
      const table = tables[0] as any
      expect(table.hasHeader).toBe(false)
    })

    it(`does not match rows without consistent separators`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Hello world`),
        makeTextRun(1, 0, `Another line here`),
        makeTextRun(2, 0, `Third plain line`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(0)
    })

    it(`requires at least 2 consistent separator positions`, () => {
      // Only one pipe per row -> 1 consistent position -> no table
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Col A | Col B`),
        makeTextRun(1, 0, `Val 1 | Val 2`),
        makeTextRun(2, 0, `Val 3 | Val 4`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(0)
    })

    it(`handles empty cells in table`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `A  | B  | C`),
        makeTextRun(1, 0, `x  |    | z`),
        makeTextRun(2, 0, `   | y  |  `),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(1)
      const table = tables[0] as any
      // Row 2 should have an empty first cell
      const row2Texts = table.children[2].cells.map((c: any) => c[0].text)
      expect(row2Texts).toContain(``)
    })

    it(`detects box-drawing vertical separators (│)`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Name  │ Age │ City`),
        makeTextRun(1, 0, `Alice │ 30  │ NYC`),
        makeTextRun(2, 0, `Bob   │ 25  │ LA`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      expect(tables).toHaveLength(1)
    })

    it(`table followed by non-table content produces both nodes`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `A  | B  | C`),
        makeTextRun(1, 0, `x  | y  | z`),
        makeTextRun(2, 0, `1  | 2  | 3`),
        makeGap(3, 2),
        makeTextRun(5, 0, `Some plain text after the table`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      const tables = result.filter((n) => n.type === `Table`)
      const textLines = result.filter((n) => n.type === `TextLine`)
      expect(tables.length).toBeGreaterThanOrEqual(1)
      expect(textLines.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe(`empty input`, () => {
    it(`returns empty array for empty tokens`, () => {
      const result = parseFlatContent([], defaultBounds, defaultCursor)
      expect(result).toEqual([])
    })
  })

  describe(`mixed content`, () => {
    it(`handles text and gaps together`, () => {
      const tokens: TToken[] = [
        makeTextRun(0, 0, `Top content`),
        makeGap(1, 1),
        makeTextRun(2, 0, `Bottom content`),
      ]
      const result = parseFlatContent(tokens, defaultBounds, defaultCursor)
      // Should have at least 2 TextLines and 1 Separator
      const textLines = result.filter((n) => n.type === `TextLine`)
      const seps = result.filter((n) => n.type === `Separator`)
      expect(textLines.length).toBeGreaterThanOrEqual(2)
      expect(seps.length).toBeGreaterThanOrEqual(1)
    })
  })
})
