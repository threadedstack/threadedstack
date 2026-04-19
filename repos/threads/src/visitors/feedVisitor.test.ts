import { describe, it, expect, beforeEach } from 'vitest'
import { diffToFeedEvents, findNodesByType } from './feedVisitor'
import * as N from '../ast/nodes'

const rect = { top: 0, left: 0, bottom: 10, right: 80 }
const rgb = { r: 255, g: 255, b: 255 }
const bgRgb = { r: 0, g: 0, b: 0 }

function emptyDoc(mode: 'idle' | 'interactive' | 'streaming' | 'tui' = 'interactive') {
  return N.document(rect, [], mode)
}

describe('feedVisitor', () => {
  describe('findNodesByType', () => {
    it('finds nodes at the top level', () => {
      const input = N.textInput(rect, 'Enter value:', '', 0)
      const doc = N.document(rect, [input], 'interactive')
      const results = findNodesByType(doc, 'TextInput')
      expect(results).toHaveLength(1)
    })

    it('finds nodes nested inside a panel', () => {
      const input = N.textInput(rect, 'Nested prompt:', '', 0)
      const panelNode = N.panel(rect, [input])
      const doc = N.document(rect, [panelNode], 'interactive')
      const results = findNodesByType(doc, 'TextInput')
      expect(results).toHaveLength(1)
    })

    it('finds nodes nested inside a group', () => {
      const diff = N.diffBlock(rect, [])
      const grp = N.group(rect, [diff])
      const doc = N.document(rect, [grp], 'interactive')
      const results = findNodesByType(doc, 'DiffBlock')
      expect(results).toHaveLength(1)
    })

    it('returns empty array when no nodes match', () => {
      const doc = N.document(rect, [], 'interactive')
      expect(findNodesByType(doc, 'TextInput')).toHaveLength(0)
    })
  })

  describe('mode transitions', () => {
    it('emits idle event when next.mode is idle', () => {
      const prev = emptyDoc('interactive')
      const next = emptyDoc('idle')
      const events = diffToFeedEvents(prev, next)
      expect(events).toHaveLength(1)
      expect(events[0].kind).toBe('idle')
      if (events[0].kind === 'idle') {
        expect(typeof events[0].timestamp).toBe('number')
      }
    })

    it('emits tui active event when next.mode is tui', () => {
      const prev = emptyDoc('interactive')
      const next = emptyDoc('tui')
      const events = diffToFeedEvents(prev, next)
      const tuiEvent = events.find((e) => e.kind === 'tui')
      expect(tuiEvent).toBeDefined()
      if (tuiEvent?.kind === 'tui') {
        expect(tuiEvent.status).toBe('active')
        expect(tuiEvent.regionTree).toBe(next)
      }
    })

    it('emits tui exited event when prev was tui and next is not', () => {
      const prev = emptyDoc('tui')
      const next = emptyDoc('interactive')
      const events = diffToFeedEvents(prev, next)
      const tuiEvent = events.find((e) => e.kind === 'tui')
      expect(tuiEvent).toBeDefined()
      if (tuiEvent?.kind === 'tui') {
        expect(tuiEvent.status).toBe('exited')
        expect(tuiEvent.regionTree).toBe(prev)
      }
    })
  })

  describe('TextInput transitions', () => {
    it('emits prompt waiting when TextInput appears', () => {
      const prev = emptyDoc('interactive')
      const input = N.textInput(rect, 'What is your name?', '', 0)
      const next = N.document(rect, [input], 'interactive')
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === 'prompt')
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === 'prompt') {
        expect(promptEvent.status).toBe('waiting')
        expect(promptEvent.question).toBe('What is your name?')
      }
    })

    it('emits prompt answered when TextInput disappears', () => {
      const input = N.textInput(rect, 'What is your name?', '', 0)
      const prev = N.document(rect, [input], 'interactive')
      const next = emptyDoc('interactive')
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === 'prompt')
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === 'prompt') {
        expect(promptEvent.status).toBe('answered')
        expect(promptEvent.question).toBe('What is your name?')
      }
    })
  })

  describe('SelectList transitions', () => {
    it('emits prompt waiting with options when SelectList appears', () => {
      const prev = emptyDoc('interactive')
      const items = [
        N.selectItem(rect, 0, [N.span('Option A', rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span('Option B', rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0, 'numbered')
      const next = N.document(rect, [list], 'interactive')
      const events = diffToFeedEvents(prev, next)
      const promptEvent = events.find((e) => e.kind === 'prompt')
      expect(promptEvent).toBeDefined()
      if (promptEvent?.kind === 'prompt') {
        expect(promptEvent.status).toBe('waiting')
        expect(promptEvent.question).toBe('Select an option')
        expect(promptEvent.options).toEqual(['Option A', 'Option B'])
      }
    })
  })

  describe('DiffBlock transitions', () => {
    it('emits action running event when DiffBlock appears', () => {
      const prev = emptyDoc('interactive')
      const diff = N.diffBlock(rect, [])
      const next = N.document(rect, [diff], 'interactive')
      const events = diffToFeedEvents(prev, next)
      const actionEvent = events.find((e) => e.kind === 'action')
      expect(actionEvent).toBeDefined()
      if (actionEvent?.kind === 'action') {
        expect(actionEvent.status).toBe('running')
        expect(actionEvent.action).toBe('edit')
        expect(actionEvent.target).toBe('file')
      }
    })

    it('does not emit action event when no new DiffBlock', () => {
      const diff = N.diffBlock(rect, [])
      const prev = N.document(rect, [diff], 'interactive')
      const next = N.document(rect, [diff], 'interactive')
      const events = diffToFeedEvents(prev, next)
      const actionEvent = events.find((e) => e.kind === 'action')
      expect(actionEvent).toBeUndefined()
    })
  })

  describe('streaming output', () => {
    it('emits output streaming when >5 new TextLines in streaming mode', () => {
      const prev = emptyDoc('streaming')
      const lines = Array.from({ length: 7 }, (_, i) =>
        N.textLine(rect, [N.span(`line ${i}`, rgb, bgRgb)])
      )
      const next = N.document(rect, lines, 'streaming')
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === 'output')
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === 'output') {
        expect(outputEvent.status).toBe('streaming')
        expect(outputEvent.lines).toHaveLength(7)
        expect(outputEvent.collapsed).toBe(false)
      }
    })

    it('emits output for any new TextLines in streaming mode', () => {
      const prev = emptyDoc('streaming')
      const lines = Array.from({ length: 3 }, (_, i) =>
        N.textLine(rect, [N.span(`line ${i}`, rgb, bgRgb)])
      )
      const next = N.document(rect, lines, 'streaming')
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === 'output')
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === 'output') {
        expect(outputEvent.status).toBe('streaming')
        expect(outputEvent.lines).toHaveLength(3)
      }
    })

    it('emits output for new TextLines in interactive mode', () => {
      const prev = emptyDoc('interactive')
      const lines = Array.from({ length: 10 }, (_, i) =>
        N.textLine(rect, [N.span(`line ${i}`, rgb, bgRgb)])
      )
      const next = N.document(rect, lines, 'interactive')
      const events = diffToFeedEvents(prev, next)
      const outputEvent = events.find((e) => e.kind === 'output')
      expect(outputEvent).toBeDefined()
      if (outputEvent?.kind === 'output') {
        expect(outputEvent.status).toBe('complete')
        expect(outputEvent.lines).toHaveLength(10)
      }
    })

    it('does not emit output in idle or tui modes', () => {
      for (const mode of ['idle', 'tui'] as const) {
        const prev = emptyDoc(mode)
        const lines = Array.from({ length: 10 }, (_, i) =>
          N.textLine(rect, [N.span(`line ${i}`, rgb, bgRgb)])
        )
        const next = N.document(rect, lines, mode)
        const events = diffToFeedEvents(prev, next)
        const outputEvent = events.find((e) => e.kind === 'output')
        expect(outputEvent).toBeUndefined()
      }
    })
  })
})
