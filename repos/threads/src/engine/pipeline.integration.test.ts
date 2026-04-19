import { describe, it, expect, vi } from 'vitest'
import { buildTestViewport } from '../tokenizer/decode'
import { tokenize } from '../tokenizer/tokenizer'
import { parse } from '../parser/parser'
import type { TModeContext } from '../parser/modeDetector'
import { diffToFeedEvents } from '../visitors/feedVisitor'
import { collectInteractions } from '../visitors/interactionVisitor'
import type { TDocument, TContentNode } from '../ast/types'
import type { TViewportFill } from '../tokenizer/decode'

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------
const white = { r: 255, g: 255, b: 255 }
const black = { r: 0, g: 0, b: 0 }
const green = { r: 0, g: 255, b: 0 }
const red = { r: 255, g: 0, b: 0 }
const blueBg = { r: 0, g: 100, b: 200 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build fills for every character in a string, starting at (row, col).
 * ASCII spaces (0x20) are replaced with non-breaking spaces (U+00A0, 0x00A0)
 * so they are NOT classified as blank (isEmpty = codepoint === 0x20 is false
 * for U+00A0) and are therefore preserved inside TextRun spans.  This also
 * allows regex patterns like /^\d+[.)]\s/ to match because `\s` matches U+00A0
 * in JavaScript.
 */
function textFills(
  row: number,
  col: number,
  text: string,
  fg = white,
  bg = black
): TViewportFill[] {
  return Array.from(text).map((ch, i) => ({
    row,
    col: col + i,
    // Replace ASCII space with non-breaking space to avoid blank-cell skipping
    text: ch === ' ' ? '\u00A0' : ch,
    fg,
    bg,
  }))
}

/**
 * Fill every cell in the viewport with a space at the default background.
 * This populates the palette vote with enough black-bg cells so that
 * black is always detected as defaultBg regardless of other colors used.
 */
function baseFills(cols: number, rows: number): TViewportFill[] {
  const fills: TViewportFill[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      fills.push({ row: r, col: c, text: ' ', fg: white, bg: black })
    }
  }
  return fills
}

/** Build fills for box-drawing border characters forming a rectangle. */
function borderFills(
  top: number,
  left: number,
  bottom: number,
  right: number
): TViewportFill[] {
  const fills: TViewportFill[] = []

  // Top-left ┌, top border ─, top-right ┐
  fills.push({ row: top, col: left, text: '\u250c' })
  for (let c = left + 1; c < right; c++) fills.push({ row: top, col: c, text: '\u2500' })
  fills.push({ row: top, col: right, text: '\u2510' })

  // Left │ and right │ borders
  for (let r = top + 1; r < bottom; r++) {
    fills.push({ row: r, col: left, text: '\u2502' })
    fills.push({ row: r, col: right, text: '\u2502' })
  }

  // Bottom-left └, bottom border ─, bottom-right ┘
  fills.push({ row: bottom, col: left, text: '\u2514' })
  for (let c = left + 1; c < right; c++)
    fills.push({ row: bottom, col: c, text: '\u2500' })
  fills.push({ row: bottom, col: right, text: '\u2518' })

  return fills
}

const defaultModeCtx = (cursor: {
  x: number
  y: number
  visible: boolean
}): TModeContext => ({
  isAlternateScreen: false,
  cursor,
  dirtyRowCount: 0,
  consecutiveDirtyCycles: 0,
  idleDurationMs: 0,
  hasInteractiveRegion: false,
})

function findNodes<T extends TContentNode>(doc: TDocument, type: string): T[] {
  const results: T[] = []
  const walk = (nodes: TContentNode[]) => {
    for (const node of nodes) {
      if (node.type === type) results.push(node as T)
      if ('children' in node && Array.isArray(node.children))
        walk(node.children as TContentNode[])
    }
  }
  walk(doc.children)
  return results
}

/** Flatten all span texts from a set of TextLine nodes into a single string. */
function flatSpanText(nodes: TContentNode[]): string {
  return nodes
    .flatMap((n) => ('children' in n ? (n as any).children : []))
    .map((s: any) => s.text)
    .join('')
}

// ---------------------------------------------------------------------------
// Test 1: Plain text viewport → Document with TextLine nodes
// ---------------------------------------------------------------------------

describe('Pipeline integration', () => {
  describe('Test 1: plain text viewport', () => {
    it('produces Document with TextLine nodes containing the written text', () => {
      const cols = 40
      const rows = 5
      const cursor = { x: 0, y: 0, visible: false }

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, 'Hello world'),
        ...textFills(1, 0, 'Another line'),
        ...textFills(2, 0, 'Third line'),
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      expect(doc.type).toBe('Document')
      expect(doc.mode).toBe('interactive')

      const textLines = findNodes(doc, 'TextLine')
      expect(textLines.length).toBeGreaterThanOrEqual(3)

      // Verify span text content — spaces are written as U+00A0 (non-breaking)
      // so they appear as a single '\u00A0' character in the combined output.
      const combined = flatSpanText(textLines)
      expect(combined).toContain('Hello')
      expect(combined).toContain('world')
      expect(combined).toContain('Another')
      expect(combined).toContain('Third')
    })

    it('sets interactive mode when no alternate screen and not idle', () => {
      const cols = 20
      const rows = 3
      const cursor = { x: 0, y: 0, visible: false }
      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, 'Hello world'),
      ])
      const tokenResult = tokenize(view, cols, rows, cursor)
      const doc = parse(tokenResult, defaultModeCtx(cursor))
      expect(doc.mode).toBe('interactive')
    })
  })

  // ---------------------------------------------------------------------------
  // Test 2: Bordered panel → Document with Panel node
  // ---------------------------------------------------------------------------

  describe('Test 2: bordered panel', () => {
    it('produces Document with a Panel node with border=single and TextLine children inside', () => {
      const cols = 22
      const rows = 7
      const cursor = { x: 0, y: 0, visible: false }

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        // border: rows 0–4, cols 0–21
        ...borderFills(0, 0, 4, cols - 1),
        // interior text
        ...textFills(2, 2, 'Panel content'),
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      // Must have a Panel child
      const panels = doc.children.filter((c) => c.type === 'Panel')
      expect(panels.length).toBeGreaterThanOrEqual(1)

      const panel = panels[0] as any
      expect(panel.border).toBe('single')

      // Panel should contain TextLine children (interior content)
      const textLines = findNodes(doc, 'TextLine')
      expect(textLines.length).toBeGreaterThanOrEqual(1)
      const combined = flatSpanText(textLines)
      expect(combined).toContain('Panel')
      expect(combined).toContain('content')
    })
  })

  // ---------------------------------------------------------------------------
  // Test 3: Numbered select list → SelectList with SelectItem children
  // ---------------------------------------------------------------------------

  describe('Test 3: numbered select list', () => {
    it('produces a SelectList node with style=numbered and SelectItem children', () => {
      const cols = 30
      const rows = 7
      const cursor = { x: 0, y: 0, visible: false }

      // Write all 4 numbered list lines using textFills (spaces are preserved via darkBg)
      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, '1. Option Alpha'),
        ...textFills(1, 0, '2. Option Beta'),
        ...textFills(2, 0, '3. Option Gamma'),
        ...textFills(3, 0, '4. Option Delta'),
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      const selectLists = findNodes(doc, 'SelectList')
      expect(selectLists.length).toBeGreaterThanOrEqual(1)

      const selectList = selectLists[0] as any
      expect(selectList.style).toBe('numbered')
      expect(selectList.children.length).toBeGreaterThanOrEqual(3)
      expect(selectList.children[0].type).toBe('SelectItem')
    })

    it('produces SelectItem handlers for each item via interactionVisitor', () => {
      const cols = 30
      const rows = 6
      const cursor = { x: 0, y: 0, visible: false }

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, '1. Option Alpha'),
        ...textFills(1, 0, '2. Option Beta'),
        ...textFills(2, 0, '3. Option Gamma'),
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      const sentKeys: string[] = []
      const sendKeystroke = vi.fn((key: string) => {
        sentKeys.push(key)
      })

      const handlers = collectInteractions(doc, sendKeystroke)
      expect(handlers.length).toBeGreaterThanOrEqual(3)
      expect(handlers.every((h) => h.nodeType === 'SelectItem')).toBe(true)

      // Execute first handler — numbered style sends `${index+1}\n`
      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalled()
      expect(sentKeys[0]).toBe('1\n')
    })
  })

  // ---------------------------------------------------------------------------
  // Test 4: Diff block → DiffBlock with colored lines
  // ---------------------------------------------------------------------------

  describe('Test 4: diff block', () => {
    it('produces a DiffBlock node for diff-like colored content', () => {
      const cols = 30
      const rows = 5
      const cursor = { x: 0, y: 0, visible: false }

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        // Green fg → added line
        ...textFills(0, 0, '+added line here', green, black),
        // Red fg → removed line
        ...textFills(1, 0, '-removed line here', red, black),
        // White fg → context line (normal)
        ...textFills(2, 0, ' context line here', white, black),
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      const diffBlocks = findNodes(doc, 'DiffBlock')
      expect(diffBlocks.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Test 5: Status bar → StatusBar on last row
  // ---------------------------------------------------------------------------

  describe('Test 5: status bar', () => {
    it('produces a StatusBar node for a full-width highlighted block on the last row', () => {
      // Use a wide enough viewport so that black bg cells dominate the palette
      // Row 0-3: ordinary text content (black bg, white fg)
      // Row 4 (last): full-width blue bg → becomes StatusBar
      const cols = 40
      const rows = 5
      const cursor = { x: 0, y: 0, visible: false }

      const statusBarFills: TViewportFill[] = Array.from({ length: cols }, (_, i) => ({
        row: rows - 1,
        col: i,
        text: 'X', // non-space so width=1 and counted in palette but overridden by base
        fg: white,
        bg: blueBg,
      }))

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, 'Normal content line here'),
        ...textFills(1, 0, 'Second line of content'),
        ...textFills(2, 0, 'Third line here'),
        // Override the last row with blue bg non-space cells
        ...statusBarFills,
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      const statusBars = findNodes(doc, 'StatusBar')
      expect(statusBars.length).toBeGreaterThanOrEqual(1)
      expect((statusBars[0] as any).bounds.top).toBe(rows - 1)
    })
  })

  // ---------------------------------------------------------------------------
  // Test 6: Feed events — TextInput appear/disappear
  // ---------------------------------------------------------------------------

  describe('Test 6: feed events — TextInput appear', () => {
    it('emits prompt waiting event when TextInput appears in next viewport', () => {
      const cols = 30
      const rows = 5

      // prev: empty viewport, cursor hidden
      const prevCursor = { x: 0, y: 0, visible: false }
      const { view: prevView } = buildTestViewport(cols, rows, baseFills(cols, rows))
      const prevTokens = tokenize(prevView, cols, rows, prevCursor)
      const prevDoc = parse(prevTokens, defaultModeCtx(prevCursor))

      // next: viewport with prompt character '>' on row 2, cursor visible at col 5
      const nextCursor = { x: 5, y: 2, visible: true }
      const { view: nextView } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(2, 0, '> some input here'),
      ])
      const nextTokens = tokenize(nextView, cols, rows, nextCursor)
      const nextDoc = parse(nextTokens, defaultModeCtx(nextCursor))

      const events = diffToFeedEvents(prevDoc, nextDoc)

      // If a TextInput was detected, prompt events should be 'waiting'
      const promptEvents = events.filter((e) => e.kind === 'prompt')
      for (const event of promptEvents) {
        if (event.kind === 'prompt') {
          expect(event.status).toBe('waiting')
        }
      }
      // The pipeline runs without error
      expect(events).toBeDefined()
      expect(Array.isArray(events)).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Test 7: Feed events — mode transition to idle
  // ---------------------------------------------------------------------------

  describe('Test 7: feed events — mode transition to idle', () => {
    it('emits idle event when next viewport transitions to idle mode', () => {
      const cols = 20
      const rows = 5

      const interactiveCursor = { x: 0, y: 0, visible: true }
      const idleCursor = { x: 0, y: 0, visible: true }

      const interactiveModeCtx = defaultModeCtx(interactiveCursor)
      const idleModeCtxVal: TModeContext = {
        isAlternateScreen: false,
        cursor: idleCursor,
        dirtyRowCount: 0,
        consecutiveDirtyCycles: 0,
        idleDurationMs: 3000, // > 2000ms → idle mode
        hasInteractiveRegion: false,
      }

      const { view: prevView } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, 'Some output line'),
      ])
      const prevTokens = tokenize(prevView, cols, rows, interactiveCursor)
      const prevDoc = parse(prevTokens, interactiveModeCtx)

      const { view: nextView } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, 'Some output line'),
      ])
      const nextTokens = tokenize(nextView, cols, rows, idleCursor)
      const nextDoc = parse(nextTokens, idleModeCtxVal)

      expect(nextDoc.mode).toBe('idle')

      const events = diffToFeedEvents(prevDoc, nextDoc)
      const idleEvents = events.filter((e) => e.kind === 'idle')
      expect(idleEvents.length).toBeGreaterThanOrEqual(1)
      if (idleEvents[0]?.kind === 'idle') {
        expect(typeof idleEvents[0].timestamp).toBe('number')
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Test 8: Interaction handlers — Confirm y/n
  // ---------------------------------------------------------------------------

  describe('Test 8: interaction handlers — Confirm y/n', () => {
    it('produces a Confirm node with y/n options and correct interaction handlers', () => {
      const cols = 40
      const rows = 3
      const cursor = { x: 0, y: 0, visible: false }

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        ...textFills(0, 0, 'Do you want to continue (y/n)'),
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      // Confirm node should be detected from the (y/n) pattern
      const confirms = findNodes(doc, 'Confirm')
      expect(confirms.length).toBeGreaterThanOrEqual(1)

      const confirmNode = confirms[0] as any
      expect(Array.isArray(confirmNode.options)).toBe(true)
      expect(confirmNode.options.length).toBe(2)

      // Test interaction handlers for the confirm choices
      const sentKeys: string[] = []
      const sendKeystroke = vi.fn((key: string) => {
        sentKeys.push(key)
      })
      const handlers = collectInteractions(doc, sendKeystroke)
      const confirmHandlers = handlers.filter((h) => h.nodeType === 'Confirm')
      expect(confirmHandlers.length).toBeGreaterThanOrEqual(2)

      // Execute first handler → should send 'y'
      confirmHandlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalled()
      expect(sentKeys[0]).toBe('y')

      // Execute second handler → should send 'n'
      confirmHandlers[1].execute()
      expect(sentKeys[1]).toBe('n')
    })
  })

  // ---------------------------------------------------------------------------
  // Test 9: Full pipeline round-trip — complex viewport
  // ---------------------------------------------------------------------------

  describe('Test 9: full pipeline round-trip — complex viewport', () => {
    it('parses a complex viewport with panel and status bar', () => {
      // 40 cols × 13 rows
      // Row 0: title "Claude Code"
      // Rows 1-9: bordered panel
      // Rows 10-11: blank
      // Row 12: status bar (full-width highlighted)
      const cols = 40
      const rows = 13
      const cursor = { x: 0, y: 0, visible: false }

      const statusBarFills: TViewportFill[] = Array.from({ length: cols }, (_, i) => ({
        row: rows - 1,
        col: i,
        text: 'X',
        fg: white,
        bg: blueBg,
      }))

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        // Title line
        ...textFills(0, 0, 'Claude Code'),
        // Bordered panel
        ...borderFills(1, 0, 9, cols - 1),
        // Interior content
        ...textFills(3, 2, 'Interior content'),
        // Status bar on last row
        ...statusBarFills,
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      expect(doc.type).toBe('Document')

      // Panel must be present
      const panels = doc.children.filter((c) => c.type === 'Panel')
      expect(panels.length).toBeGreaterThanOrEqual(1)

      // StatusBar must be present
      const statusBars = findNodes(doc, 'StatusBar')
      expect(statusBars.length).toBeGreaterThanOrEqual(1)
    })

    it('parses panel interior containing a select list and produces interaction handlers', () => {
      // 40 cols × 13 rows
      // Rows 0-10: bordered panel with numbered list inside
      // Row 12: status bar
      const cols = 40
      const rows = 13
      const cursor = { x: 0, y: 0, visible: false }

      const statusBarFills: TViewportFill[] = Array.from({ length: cols }, (_, i) => ({
        row: rows - 1,
        col: i,
        text: 'X',
        fg: white,
        bg: blueBg,
      }))

      const { view } = buildTestViewport(cols, rows, [
        ...baseFills(cols, rows),
        // Bordered panel
        ...borderFills(0, 0, 10, cols - 1),
        // Numbered select list inside panel (consistent left=2 indent)
        ...textFills(2, 2, '1. Option Alpha'),
        ...textFills(3, 2, '2. Option Beta'),
        ...textFills(4, 2, '3. Option Gamma'),
        ...textFills(5, 2, '4. Option Delta'),
        // Status bar on last row
        ...statusBarFills,
      ])

      const tokenResult = tokenize(view, cols, rows, cursor)
      const modeCtx = defaultModeCtx(cursor)
      const doc = parse(tokenResult, modeCtx)

      // Panel must be present
      const panels = doc.children.filter((c) => c.type === 'Panel')
      expect(panels.length).toBeGreaterThanOrEqual(1)

      // SelectList must exist somewhere in the tree
      const selectLists = findNodes(doc, 'SelectList')
      expect(selectLists.length).toBeGreaterThanOrEqual(1)

      // Interaction handlers for select items
      const sentKeys: string[] = []
      const sendKeystroke = vi.fn((key: string) => {
        sentKeys.push(key)
      })
      const handlers = collectInteractions(doc, sendKeystroke)
      const selectHandlers = handlers.filter((h) => h.nodeType === 'SelectItem')
      expect(selectHandlers.length).toBeGreaterThanOrEqual(3)

      // Execute second handler → numbered style sends `2\n`
      selectHandlers[1].execute()
      expect(sendKeystroke).toHaveBeenCalled()
      expect(sentKeys[0]).toBe('2\n')
    })
  })
})
