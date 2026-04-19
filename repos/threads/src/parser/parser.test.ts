import { describe, it, expect } from 'vitest'
import { parse } from './parser'
import type { TModeContext } from './modeDetector'
import type { TTokenizeResult } from '../tokenizer'
import type {
  TToken,
  TBorderFrame,
  TTextRun,
  TCursorToken,
  TPalette,
  TCellMeta,
} from '../tokenizer/types'

const defaultPalette: TPalette = {
  defaultBg: { r: 0, g: 0, b: 0 },
  defaultFg: { r: 200, g: 200, b: 200 },
}

const defaultMeta: TCellMeta[][] = []

function makeTextRun(row: number, col: number, text: string): TTextRun {
  return {
    type: 'TextRun',
    bounds: { top: row, left: col, bottom: row, right: col + text.length - 1 },
    spans: [
      {
        text,
        fg: { r: 200, g: 200, b: 200 },
        bg: { r: 0, g: 0, b: 0 },
        flags: 0,
      },
    ],
  }
}

function makeCursor(x: number, y: number, visible: boolean): TCursorToken {
  return { type: 'CursorToken', position: { x, y }, visible }
}

function makeFrame(
  top: number,
  left: number,
  bottom: number,
  right: number
): TBorderFrame {
  return {
    type: 'BorderFrame',
    bounds: { top, left, bottom, right },
    interior: { top: top + 1, left: left + 1, bottom: bottom - 1, right: right - 1 },
    style: 'single',
  }
}

function makeTokenResult(tokens: TToken[], cursor?: TCursorToken): TTokenizeResult {
  const cur = cursor || makeCursor(0, 0, false)
  return {
    tokens: [...tokens, cur],
    cursor: cur,
    palette: defaultPalette,
    meta: defaultMeta,
  }
}

const idleModeCtx: TModeContext = {
  isAlternateScreen: false,
  cursor: { x: 0, y: 0, visible: true },
  dirtyRowCount: 0,
  consecutiveDirtyCycles: 0,
  idleDurationMs: 3000,
  hasInteractiveRegion: false,
}

const interactiveModeCtx: TModeContext = {
  isAlternateScreen: false,
  cursor: { x: 0, y: 0, visible: true },
  dirtyRowCount: 0,
  consecutiveDirtyCycles: 0,
  idleDurationMs: 0,
  hasInteractiveRegion: false,
}

const tuiModeCtx: TModeContext = {
  isAlternateScreen: true,
  cursor: { x: 0, y: 0, visible: false },
  dirtyRowCount: 0,
  consecutiveDirtyCycles: 0,
  idleDurationMs: 0,
  hasInteractiveRegion: false,
}

describe('parse', () => {
  it('returns a Document node with correct type', () => {
    const tokenResult = makeTokenResult([makeTextRun(0, 0, 'Hello')])
    const doc = parse(tokenResult, interactiveModeCtx)
    expect(doc.type).toBe('Document')
  })

  it('detects idle mode and sets it on the Document', () => {
    const tokenResult = makeTokenResult([makeTextRun(0, 0, 'Hello')])
    const doc = parse(tokenResult, idleModeCtx)
    expect(doc.mode).toBe('idle')
  })

  it('detects interactive mode', () => {
    const tokenResult = makeTokenResult([makeTextRun(0, 0, 'Hello')])
    const doc = parse(tokenResult, interactiveModeCtx)
    expect(doc.mode).toBe('interactive')
  })

  it('detects tui mode', () => {
    const tokenResult = makeTokenResult([makeTextRun(0, 0, 'Hello')])
    const doc = parse(tokenResult, tuiModeCtx)
    expect(doc.mode).toBe('tui')
  })

  it('sets cursor from the tokenize result', () => {
    const cursor = makeCursor(5, 10, true)
    const tokenResult = makeTokenResult([makeTextRun(0, 0, 'Hello')], cursor)
    const doc = parse(tokenResult, interactiveModeCtx)
    expect(doc.cursor).toEqual({ x: 5, y: 10, visible: true })
  })

  it('derives bounds from tokens', () => {
    const tokenResult = makeTokenResult([
      makeTextRun(2, 5, 'Hello'),
      makeTextRun(8, 10, 'World'),
    ])
    const doc = parse(tokenResult, interactiveModeCtx)
    expect(doc.bounds.top).toBeLessThanOrEqual(2)
    expect(doc.bounds.left).toBeLessThanOrEqual(5)
    expect(doc.bounds.bottom).toBeGreaterThanOrEqual(8)
    expect(doc.bounds.right).toBeGreaterThanOrEqual(14)
  })

  it('parses flat text runs into TextLine children', () => {
    const tokenResult = makeTokenResult([
      makeTextRun(0, 0, 'Line 1'),
      makeTextRun(1, 0, 'Line 2'),
    ])
    const doc = parse(tokenResult, interactiveModeCtx)
    const textLines = doc.children.filter((c) => c.type === 'TextLine')
    expect(textLines.length).toBeGreaterThanOrEqual(2)
  })

  it('parses border frames into Panel children', () => {
    const frame = makeFrame(0, 0, 5, 30)
    const interiorText = makeTextRun(2, 3, 'Inside frame')
    const tokenResult = makeTokenResult([frame, interiorText])
    const doc = parse(tokenResult, interactiveModeCtx)
    const panels = doc.children.filter((c) => c.type === 'Panel')
    expect(panels).toHaveLength(1)
    expect(panels[0].type).toBe('Panel')
  })

  it('includes both panels and flat content in children', () => {
    const frame = makeFrame(0, 0, 5, 30)
    const insideText = makeTextRun(2, 3, 'Inside')
    const outsideText = makeTextRun(8, 0, 'Outside')
    const tokenResult = makeTokenResult([frame, insideText, outsideText])
    const doc = parse(tokenResult, interactiveModeCtx)
    const panels = doc.children.filter((c) => c.type === 'Panel')
    const lines = doc.children.filter((c) => c.type === 'TextLine')
    expect(panels).toHaveLength(1)
    expect(lines.length).toBeGreaterThanOrEqual(1)
  })

  it('returns a Document with empty children for empty token result', () => {
    const tokenResult = makeTokenResult([])
    const doc = parse(tokenResult, interactiveModeCtx)
    expect(doc.type).toBe('Document')
    expect(doc.children).toHaveLength(0)
  })

  it('uses fallback bounds when no tokens have bounds', () => {
    const cursor = makeCursor(0, 0, false)
    const tokenResult: TTokenizeResult = {
      tokens: [cursor],
      cursor,
      palette: defaultPalette,
      meta: defaultMeta,
    }
    const doc = parse(tokenResult, interactiveModeCtx)
    expect(doc.bounds).toEqual({ top: 0, left: 0, bottom: 23, right: 79 })
  })
})
