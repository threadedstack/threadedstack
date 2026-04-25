import { describe, it, expect } from 'vitest'
import * as N from '../ast/nodes'
import { diffToFeedEvents, findNodesByType } from './feedVisitor'

const rect = { top: 0, left: 0, bottom: 10, right: 80 }
const rgb = { r: 255, g: 255, b: 255 }
const bgRgb = { r: 0, g: 0, b: 0 }

function emptyDoc(mode: `idle` | `interactive` | `streaming` | `tui` = `interactive`) {
  return N.document(rect, [], mode)
}

/** Create N text lines with distinct content */
function makeLines(count: number, prefix = `line`) {
  return Array.from({ length: count }, (_, i) =>
    N.textLine(rect, [N.span(`${prefix} ${i}`, rgb, bgRgb)])
  )
}

/** Create a text line with the given text */
function line(text: string) {
  return N.textLine(rect, [N.span(text, rgb, bgRgb)])
}

describe(`feedVisitor`, () => {
  describe(`findNodesByType`, () => {
    it(`finds nodes at the top level`, () => {
      const input = N.textInput(rect, `Enter value:`, ``, 0)
      const doc = N.document(rect, [input], `interactive`)
      const results = findNodesByType(doc, `TextInput`)
      expect(results).toHaveLength(1)
    })

    it(`finds nodes nested inside a panel`, () => {
      const input = N.textInput(rect, `Nested prompt:`, ``, 0)
      const panelNode = N.panel(rect, [input])
      const doc = N.document(rect, [panelNode], `interactive`)
      const results = findNodesByType(doc, `TextInput`)
      expect(results).toHaveLength(1)
    })

    it(`finds nodes nested inside a group`, () => {
      const diff = N.diffBlock(rect, [])
      const grp = N.group(rect, [diff])
      const doc = N.document(rect, [grp], `interactive`)
      const results = findNodesByType(doc, `DiffBlock`)
      expect(results).toHaveLength(1)
    })

    it(`returns empty array when no nodes match`, () => {
      const doc = N.document(rect, [], `interactive`)
      expect(findNodesByType(doc, `TextInput`)).toHaveLength(0)
    })
  })

  // Test 1: No change between identical snapshots
  describe(`identical snapshots`, () => {
    it(`returns empty events for two identical documents`, () => {
      const lines = makeLines(5)
      const doc = N.document(rect, lines, `interactive`)
      // Use structurally identical but separate instances
      const docCopy = N.document(rect, makeLines(5), `interactive`)
      const events = diffToFeedEvents(doc, docCopy)
      expect(events).toEqual([])
    })

    it(`returns empty events for two identical empty documents`, () => {
      const prev = emptyDoc(`interactive`)
      const next = emptyDoc(`interactive`)
      const events = diffToFeedEvents(prev, next)
      expect(events).toEqual([])
    })
  })

  describe(`mode transitions`, () => {
    // Test 2: streaming -> idle generates idle event
    it(`emits idle event when transitioning from streaming to idle`, () => {
      const prev = emptyDoc(`streaming`)
      const next = emptyDoc(`idle`)
      const events = diffToFeedEvents(prev, next)
      expect(events).toHaveLength(1)
      expect(events[0].kind).toBe(`idle`)
      if (events[0].kind === `idle`) {
        expect(typeof events[0].timestamp).toBe(`number`)
      }
    })

    it(`emits idle event when transitioning from interactive to idle`, () => {
      const prev = emptyDoc(`interactive`)
      const next = emptyDoc(`idle`)
      const events = diffToFeedEvents(prev, next)
      expect(events).toHaveLength(1)
      expect(events[0].kind).toBe(`idle`)
    })

    it(`does not emit idle event when already idle`, () => {
      const prev = emptyDoc(`idle`)
      const next = emptyDoc(`idle`)
      const events = diffToFeedEvents(prev, next)
      expect(events).toEqual([])
    })

    // Test 11: TUI mode entered
    it(`emits tui active event when next.mode is tui`, () => {
      const prev = emptyDoc(`interactive`)
      const next = emptyDoc(`tui`)
      const events = diffToFeedEvents(prev, next)
      const tuiEvent = events.find((e) => e.kind === `tui`)
      expect(tuiEvent).toBeDefined()
      if (tuiEvent?.kind === `tui`) {
        expect(tuiEvent.status).toBe(`active`)
        expect(tuiEvent.regionTree).toBe(next)
      }
    })

    // Test 12: TUI mode exited
    it(`emits tui exited event when prev was tui and next is not`, () => {
      const prev = emptyDoc(`tui`)
      const next = emptyDoc(`interactive`)
      const events = diffToFeedEvents(prev, next)
      const tuiEvent = events.find((e) => e.kind === `tui`)
      expect(tuiEvent).toBeDefined()
      if (tuiEvent?.kind === `tui`) {
        expect(tuiEvent.status).toBe(`exited`)
        expect(tuiEvent.regionTree).toBe(prev)
      }
    })
  })

  describe(`TextInput transitions`, () => {
    // Test 7: TextInput appeared
    it(`emits prompt waiting when TextInput appears`, () => {
      const prev = emptyDoc(`interactive`)
      const input = N.textInput(rect, `What is your name?`, ``, 0)
      const next = N.document(rect, [input], `interactive`)
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === `prompt`)
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === `prompt`) {
        expect(promptEvent.status).toBe(`waiting`)
        expect(promptEvent.question).toBe(`What is your name?`)
      }
    })

    // Test 8: TextInput disappeared
    it(`emits prompt answered when TextInput disappears`, () => {
      const input = N.textInput(rect, `What is your name?`, ``, 0)
      const prev = N.document(rect, [input], `interactive`)
      const next = emptyDoc(`interactive`)
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === `prompt`)
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === `prompt`) {
        expect(promptEvent.status).toBe(`answered`)
        expect(promptEvent.question).toBe(`What is your name?`)
      }
    })
  })

  describe(`SelectList transitions`, () => {
    // Test 9: SelectList appeared with non-empty items
    it(`emits prompt waiting with options when SelectList appears`, () => {
      const prev = emptyDoc(`interactive`)
      const items = [
        N.selectItem(rect, 0, [N.span(`Option A`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`Option B`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0, `numbered`)
      const next = N.document(rect, [list], `interactive`)
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === `prompt`)
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === `prompt`) {
        expect(promptEvent.status).toBe(`waiting`)
        expect(promptEvent.question).toBe(`Select an option`)
        expect(promptEvent.options).toEqual([`Option A`, `Option B`])
      }
    })

    it(`filters out separator-only items from options`, () => {
      const prev = emptyDoc(`interactive`)
      const items = [
        N.selectItem(rect, 0, [N.span(`Real Option`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`───────`, rgb, bgRgb)]),
        N.selectItem(rect, 2, [N.span(`Another Option`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0, `arrow`)
      const next = N.document(rect, [list], `interactive`)
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === `prompt`)
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === `prompt`) {
        expect(promptEvent.options).toEqual([`Real Option`, `Another Option`])
      }
    })

    it(`does not emit prompt when all select items are separators`, () => {
      const prev = emptyDoc(`interactive`)
      const items = [
        N.selectItem(rect, 0, [N.span(`─────`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`━━━━━`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0, `arrow`)
      const next = N.document(rect, [list], `interactive`)
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === `prompt`)
      expect(promptEvent).toBeUndefined()
    })
  })

  describe(`DiffBlock transitions`, () => {
    // Test 10: DiffBlock appeared
    it(`emits action running event when DiffBlock appears`, () => {
      const prev = emptyDoc(`interactive`)
      const diff = N.diffBlock(rect, [])
      const next = N.document(rect, [diff], `interactive`)
      const events = diffToFeedEvents(prev, next)
      const actionEvent = events.find((e) => e.kind === `action`)
      expect(actionEvent).toBeDefined()
      if (actionEvent?.kind === `action`) {
        expect(actionEvent.status).toBe(`running`)
        expect(actionEvent.action).toBe(`edit`)
        expect(actionEvent.target).toBe(`file`)
      }
    })

    it(`does not emit action event when DiffBlock count is unchanged`, () => {
      const diff = N.diffBlock(rect, [])
      const prev = N.document(rect, [diff], `interactive`)
      const next = N.document(rect, [diff], `interactive`)
      const events = diffToFeedEvents(prev, next)
      const actionEvent = events.find((e) => e.kind === `action`)
      expect(actionEvent).toBeUndefined()
    })
  })

  describe(`streaming output — new lines appended`, () => {
    // Test 3: New TextLines appended in streaming mode
    it(`emits output with status streaming when new lines appended in streaming mode`, () => {
      const prev = emptyDoc(`streaming`)
      const lines = makeLines(3)
      const next = N.document(rect, lines, `streaming`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.status).toBe(`streaming`)
        expect(outputEvent.lines).toHaveLength(3)
        expect(outputEvent.collapsed).toBe(false)
      }
    })

    it(`emits output with status complete when new lines appended in interactive mode`, () => {
      const prev = emptyDoc(`interactive`)
      const lines = makeLines(4)
      const next = N.document(rect, lines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.status).toBe(`complete`)
        expect(outputEvent.lines).toHaveLength(4)
      }
    })

    it(`includes only the newly appended lines (not existing ones)`, () => {
      const existingLines = makeLines(3, `existing`)
      const prev = N.document(rect, existingLines, `streaming`)
      const allLines = [...makeLines(3, `existing`), ...makeLines(2, `new`)]
      const next = N.document(rect, allLines, `streaming`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.lines).toHaveLength(2)
      }
    })

    it(`does not emit output in idle or tui modes`, () => {
      for (const mode of [`idle`, `tui`] as const) {
        const prev = emptyDoc(mode)
        const lines = makeLines(10)
        const next = N.document(rect, lines, mode)
        const events = diffToFeedEvents(prev, next)
        const outputEvent = events.find((e) => e.kind === `output`)
        expect(outputEvent).toBeUndefined()
      }
    })
  })

  describe(`in-place content changes`, () => {
    // Test 4: 4+ lines changed in-place → generates output event
    it(`emits output when 4+ lines change in-place in interactive mode`, () => {
      const prevLines = [
        line(`line A`),
        line(`line B`),
        line(`line C`),
        line(`line D`),
        line(`line E`),
      ]
      const nextLines = [
        line(`changed A`),
        line(`changed B`),
        line(`changed C`),
        line(`changed D`),
        line(`line E`),
      ]
      const prev = N.document(rect, prevLines, `interactive`)
      const next = N.document(rect, nextLines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.status).toBe(`complete`)
        expect(outputEvent.lines).toHaveLength(4)
      }
    })

    it(`emits output when 4+ lines change in-place in streaming mode`, () => {
      const prevLines = [
        line(`old 0`),
        line(`old 1`),
        line(`old 2`),
        line(`old 3`),
        line(`old 4`),
      ]
      const nextLines = [
        line(`new 0`),
        line(`new 1`),
        line(`new 2`),
        line(`new 3`),
        line(`old 4`),
      ]
      const prev = N.document(rect, prevLines, `streaming`)
      const next = N.document(rect, nextLines, `streaming`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.status).toBe(`complete`)
        expect(outputEvent.lines).toHaveLength(4)
      }
    })

    // Test 5: 2 lines changed in-place → NO output event (below 3-line threshold)
    it(`does not emit output when only 2 lines change in-place (below threshold)`, () => {
      const prevLines = [line(`line A`), line(`line B`), line(`line C`), line(`line D`)]
      const nextLines = [
        line(`changed A`),
        line(`changed B`),
        line(`line C`),
        line(`line D`),
      ]
      const prev = N.document(rect, prevLines, `interactive`)
      const next = N.document(rect, nextLines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeUndefined()
    })

    it(`does not emit output when exactly 3 lines change in-place (at threshold)`, () => {
      const prevLines = [line(`line A`), line(`line B`), line(`line C`), line(`line D`)]
      const nextLines = [
        line(`changed A`),
        line(`changed B`),
        line(`changed C`),
        line(`line D`),
      ]
      const prev = N.document(rect, prevLines, `interactive`)
      const next = N.document(rect, nextLines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeUndefined()
    })

    // Test 6: Empty/whitespace-only changed lines are filtered out
    it(`filters out empty and whitespace-only lines from changed output`, () => {
      const prevLines = [
        line(`line A`),
        line(``),
        line(`   `),
        line(`line D`),
        line(`line E`),
        line(`line F`),
      ]
      const nextLines = [
        line(`changed A`),
        line(``),
        line(`   `),
        line(`changed D`),
        line(`changed E`),
        line(`changed F`),
      ]
      const prev = N.document(rect, prevLines, `interactive`)
      const next = N.document(rect, nextLines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        // 4 lines changed in total (A, D, E, F) — all non-empty
        // Empty and whitespace lines were not changed (same content in both)
        expect(outputEvent.lines.length).toBe(4)
        // None of the output lines should be empty/whitespace
        for (const l of outputEvent.lines) {
          const text = l.children
            .map((s) => s.text)
            .join(``)
            .trim()
          expect(text.length).toBeGreaterThan(0)
        }
      }
    })

    it(`produces no output when all changed lines are whitespace-only`, () => {
      const prevLines = [line(`same`), line(``), line(`  `), line(`\t`), line(`same2`)]
      const nextLines = [
        line(`same`),
        line(` `),
        line(`   `),
        line(`\t\t`),
        line(`same2`),
      ]
      // 3 lines changed (indices 1, 2, 3) but only whitespace changes — however
      // changedCount is 3, which is not > 3, so no output is emitted anyway.
      // Let`s make it exceed the threshold by adding more whitespace-only changes.
      const prevLinesLong = [
        line(`same`),
        line(``),
        line(`  `),
        line(`\t`),
        line(``),
        line(`same2`),
      ]
      const nextLinesLong = [
        line(`same`),
        line(` `),
        line(`   `),
        line(`\t\t`),
        line(`  `),
        line(`same2`),
      ]
      const prev = N.document(rect, prevLinesLong, `interactive`)
      const next = N.document(rect, nextLinesLong, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      // 4 lines changed but all are whitespace — meaningful filter removes them all
      expect(outputEvent).toBeUndefined()
    })

    it(`collapses output when more than 5 meaningful changed lines`, () => {
      const prevLines = Array.from({ length: 8 }, (_, i) => line(`old ${i}`))
      const nextLines = Array.from({ length: 8 }, (_, i) => line(`new ${i}`))
      const prev = N.document(rect, prevLines, `interactive`)
      const next = N.document(rect, nextLines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.lines).toHaveLength(8)
        expect(outputEvent.collapsed).toBe(true)
      }
    })

    it(`does not collapse output when 5 or fewer meaningful changed lines`, () => {
      const prevLines = [
        line(`old 0`),
        line(`old 1`),
        line(`old 2`),
        line(`old 3`),
        line(`same`),
      ]
      const nextLines = [
        line(`new 0`),
        line(`new 1`),
        line(`new 2`),
        line(`new 3`),
        line(`same`),
      ]
      const prev = N.document(rect, prevLines, `interactive`)
      const next = N.document(rect, nextLines, `interactive`)
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === `output`)
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === `output`) {
        expect(outputEvent.lines).toHaveLength(4)
        expect(outputEvent.collapsed).toBe(false)
      }
    })
  })
})
