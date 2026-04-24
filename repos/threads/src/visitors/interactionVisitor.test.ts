import { describe, it, expect, vi } from 'vitest'
import { collectInteractions } from './interactionVisitor'
import * as N from '../ast/nodes'

const rect = { top: 0, left: 0, bottom: 10, right: 80 }
const rgb = { r: 255, g: 255, b: 255 }
const bgRgb = { r: 0, g: 0, b: 0 }

describe(`interactionVisitor`, () => {
  describe(`SelectList — numbered style`, () => {
    it(`sends number + newline for numbered list items`, () => {
      const sendKeystroke = vi.fn()
      const items = [
        N.selectItem(rect, 0, [N.span(`First`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`Second`, rgb, bgRgb)]),
        N.selectItem(rect, 2, [N.span(`Third`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0, `numbered`)
      const doc = N.document(rect, [list], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(3)

      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`1\n`)

      handlers[1].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`2\n`)

      handlers[2].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`3\n`)
    })
  })

  describe(`SelectList — arrow style`, () => {
    it(`sends arrow keys and enter for arrow list items`, () => {
      const sendKeystroke = vi.fn()
      const items = [
        N.selectItem(rect, 0, [N.span(`Alpha`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`Beta`, rgb, bgRgb)]),
        N.selectItem(rect, 2, [N.span(`Gamma`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0, `arrow`)
      const doc = N.document(rect, [list], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      // Selecting index 0 (same as current) — 0 arrows + enter
      sendKeystroke.mockClear()
      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledTimes(1)
      expect(sendKeystroke).toHaveBeenCalledWith(`\n`)

      // Selecting index 2 — 2 down arrows + enter
      sendKeystroke.mockClear()
      handlers[2].execute()
      expect(sendKeystroke).toHaveBeenCalledTimes(3)
      expect(sendKeystroke).toHaveBeenNthCalledWith(1, `\x1b[B`)
      expect(sendKeystroke).toHaveBeenNthCalledWith(2, `\x1b[B`)
      expect(sendKeystroke).toHaveBeenNthCalledWith(3, `\n`)
    })

    it(`sends up arrows when target index is before current`, () => {
      const sendKeystroke = vi.fn()
      const items = [
        N.selectItem(rect, 0, [N.span(`Alpha`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`Beta`, rgb, bgRgb)]),
        N.selectItem(rect, 2, [N.span(`Gamma`, rgb, bgRgb)]),
      ]
      // Current selection is index 2
      const list = N.selectList(rect, items, 2, `arrow`)
      const doc = N.document(rect, [list], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      // Selecting index 0 from index 2 — 2 up arrows + enter
      sendKeystroke.mockClear()
      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledTimes(3)
      expect(sendKeystroke).toHaveBeenNthCalledWith(1, `\x1b[A`)
      expect(sendKeystroke).toHaveBeenNthCalledWith(2, `\x1b[A`)
      expect(sendKeystroke).toHaveBeenNthCalledWith(3, `\n`)
    })
  })

  describe(`Confirm node`, () => {
    it(`sends lowercase first char for each option`, () => {
      const sendKeystroke = vi.fn()
      const confirmNode = N.confirm(rect, `Are you sure?`, [`Yes`, `No`])
      const doc = N.document(rect, [confirmNode], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(2)

      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`y`)

      handlers[1].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`n`)
    })

    it(`handles multi-word options, using first char of option`, () => {
      const sendKeystroke = vi.fn()
      const confirmNode = N.confirm(rect, `Continue?`, [`Accept`, `Decline`])
      const doc = N.document(rect, [confirmNode], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`a`)

      handlers[1].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`d`)
    })
  })

  describe(`ActionTarget node`, () => {
    it(`sends hotkey directly when hotkey is present`, () => {
      const sendKeystroke = vi.fn()
      const action = N.actionTarget(rect, `Run tests`, [], false, `r`)
      const doc = N.document(rect, [action], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(1)
      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`r`)
    })

    it(`sends arrow down + enter when no hotkey and not focused`, () => {
      const sendKeystroke = vi.fn()
      const action = N.actionTarget(rect, `Submit`, [], false)
      const doc = N.document(rect, [action], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`\x1b[B`)
      expect(sendKeystroke).toHaveBeenCalledWith(`\n`)
    })

    it(`sends only enter when no hotkey but already focused`, () => {
      const sendKeystroke = vi.fn()
      const action = N.actionTarget(rect, `Submit`, [], true)
      const doc = N.document(rect, [action], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledTimes(1)
      expect(sendKeystroke).toHaveBeenCalledWith(`\n`)
    })
  })

  describe(`Link node`, () => {
    it(`opens URL in new window without sending keystroke`, () => {
      const sendKeystroke = vi.fn()
      // globalThis.window may not exist in Node test env
      const win = globalThis as any
      if (!win.window) win.window = { open: vi.fn() }
      const openSpy = vi.spyOn(win.window, `open`).mockImplementation(() => null)
      const linkNode = N.link(
        rect,
        1,
        [N.span(`Click here`, rgb, bgRgb)],
        `https://example.com`
      )
      const doc = N.document(rect, [linkNode], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(1)
      handlers[0].execute()
      expect(openSpy).toHaveBeenCalledWith(`https://example.com`, `_blank`)
      expect(sendKeystroke).not.toHaveBeenCalled()
      openSpy.mockRestore()
    })

    it(`does not create handler for link without URL`, () => {
      const sendKeystroke = vi.fn()
      const linkNode = N.link(rect, 2, [N.span(`No URL`, rgb, bgRgb)])
      const doc = N.document(rect, [linkNode], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(0)
    })
  })

  describe(`nested container nodes`, () => {
    it(`recurses into Panel children`, () => {
      const sendKeystroke = vi.fn()
      const action = N.actionTarget(rect, `Apply`, [], false, `a`)
      const panelNode = N.panel(rect, [action])
      const doc = N.document(rect, [panelNode], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(1)
      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`a`)
    })

    it(`recurses into Group children`, () => {
      const sendKeystroke = vi.fn()
      const confirmNode = N.confirm(rect, `Proceed?`, [`OK`, `Cancel`])
      const grp = N.group(rect, [confirmNode])
      const doc = N.document(rect, [grp], `interactive`)
      const handlers = collectInteractions(doc, sendKeystroke)

      expect(handlers).toHaveLength(2)
      handlers[0].execute()
      expect(sendKeystroke).toHaveBeenCalledWith(`o`)
    })
  })
})
