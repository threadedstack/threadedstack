import { describe, it, expect } from 'vitest'
import * as N from '../ast/nodes'
import { getAriaProps } from './accessibilityVisitor'

const rect = { top: 0, left: 0, bottom: 10, right: 80 }
const rgb = { r: 255, g: 255, b: 255 }
const bgRgb = { r: 0, g: 0, b: 0 }

describe(`accessibilityVisitor`, () => {
  describe(`SelectList`, () => {
    it(`returns listbox role with aria-activedescendant for selected index`, () => {
      const items = [
        N.selectItem(rect, 0, [N.span(`First`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`Second`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 0)
      const props = getAriaProps(list)

      expect(props).toEqual({
        role: `listbox`,
        [`aria-activedescendant`]: `select-item-0`,
      })
    })

    it(`reflects the correct selectedIndex in aria-activedescendant`, () => {
      const items = [
        N.selectItem(rect, 0, [N.span(`A`, rgb, bgRgb)]),
        N.selectItem(rect, 1, [N.span(`B`, rgb, bgRgb)]),
        N.selectItem(rect, 2, [N.span(`C`, rgb, bgRgb)]),
      ]
      const list = N.selectList(rect, items, 2)
      const props = getAriaProps(list)

      expect(props[`aria-activedescendant`]).toBe(`select-item-2`)
    })
  })

  describe(`SelectItem`, () => {
    it(`returns option role with aria-selected false and correct id`, () => {
      const item = N.selectItem(rect, 0, [N.span(`Option A`, rgb, bgRgb)])
      const props = getAriaProps(item)

      expect(props).toEqual({
        role: `option`,
        [`aria-selected`]: false,
        id: `select-item-0`,
      })
    })

    it(`returns aria-selected true when selected`, () => {
      const item = N.selectItem(rect, 3, [N.span(`Option D`, rgb, bgRgb)], true)
      const props = getAriaProps(item)

      expect(props).toEqual({
        role: `option`,
        [`aria-selected`]: true,
        id: `select-item-3`,
      })
    })

    it(`uses the item index for the id`, () => {
      const item = N.selectItem(rect, 7, [N.span(`Seventh`, rgb, bgRgb)])
      const props = getAriaProps(item)

      expect(props.id).toBe(`select-item-7`)
    })
  })

  describe(`TextInput`, () => {
    it(`returns textbox role with aria-label from prompt`, () => {
      const input = N.textInput(rect, `Enter name:`, ``, 0)
      const props = getAriaProps(input)

      expect(props).toEqual({
        role: `textbox`,
        [`aria-label`]: `Enter name:`,
      })
    })

    it(`preserves the full prompt string as aria-label`, () => {
      const input = N.textInput(rect, `Search files (glob)>`, `src/**`, 6)
      const props = getAriaProps(input)

      expect(props[`aria-label`]).toBe(`Search files (glob)>`)
    })
  })

  describe(`ActionTarget`, () => {
    it(`returns button role with aria-label from label`, () => {
      const action = N.actionTarget(rect, `Submit`, [N.span(`Submit`, rgb, bgRgb)])
      const props = getAriaProps(action)

      expect(props).toEqual({
        role: `button`,
        [`aria-label`]: `Submit`,
      })
    })

    it(`uses the label regardless of span text content`, () => {
      const action = N.actionTarget(
        rect,
        `Run tests`,
        [N.span(`[r]`, rgb, bgRgb), N.span(` Run tests`, rgb, bgRgb)],
        false,
        `r`
      )
      const props = getAriaProps(action)

      expect(props[`aria-label`]).toBe(`Run tests`)
    })
  })

  describe(`Table`, () => {
    it(`returns table role`, () => {
      const row = N.tableRow(rect, [[N.span(`Cell`, rgb, bgRgb)]])
      const tbl = N.table(rect, [row])
      const props = getAriaProps(tbl)

      expect(props).toEqual({ role: `table` })
    })

    it(`returns table role for tables with headers`, () => {
      const header = N.tableRow(rect, [[N.span(`Name`, rgb, bgRgb)]], true)
      const row = N.tableRow(rect, [[N.span(`Alice`, rgb, bgRgb)]])
      const tbl = N.table(rect, [header, row], true)
      const props = getAriaProps(tbl)

      expect(props).toEqual({ role: `table` })
    })
  })

  describe(`StatusBar`, () => {
    it(`returns status role with aria-live polite`, () => {
      const bar = N.statusBar(rect, [[N.span(`Ready`, rgb, bgRgb)]])
      const props = getAriaProps(bar)

      expect(props).toEqual({
        role: `status`,
        [`aria-live`]: `polite`,
      })
    })
  })

  describe(`Confirm`, () => {
    it(`returns alertdialog role with aria-label from question`, () => {
      const node = N.confirm(rect, `Are you sure?`, [`Yes`, `No`])
      const props = getAriaProps(node)

      expect(props).toEqual({
        role: `alertdialog`,
        [`aria-label`]: `Are you sure?`,
      })
    })

    it(`preserves the full question text as aria-label`, () => {
      const node = N.confirm(rect, `Delete all files permanently?`, [`OK`, `Cancel`])
      const props = getAriaProps(node)

      expect(props[`aria-label`]).toBe(`Delete all files permanently?`)
    })
  })

  describe(`default — nodes without specific ARIA mappings`, () => {
    it(`returns empty object for TextLine`, () => {
      const line = N.textLine(rect, [N.span(`Hello`, rgb, bgRgb)])
      const props = getAriaProps(line)

      expect(props).toEqual({})
    })

    it(`returns empty object for DiffBlock`, () => {
      const diff = N.diffBlock(rect, [N.textLine(rect, [N.span(`+added`, rgb, bgRgb)])])
      const props = getAriaProps(diff)

      expect(props).toEqual({})
    })

    it(`returns empty object for Link`, () => {
      const lnk = N.link(rect, 1, [N.span(`click`, rgb, bgRgb)], `https://example.com`)
      const props = getAriaProps(lnk)

      expect(props).toEqual({})
    })

    it(`returns empty object for Separator`, () => {
      const sep = N.separator(rect, `line`)
      const props = getAriaProps(sep)

      expect(props).toEqual({})
    })

    it(`returns empty object for Panel`, () => {
      const pnl = N.panel(rect, [], `single`, `My Panel`)
      const props = getAriaProps(pnl)

      expect(props).toEqual({})
    })

    it(`returns empty object for Group`, () => {
      const grp = N.group(rect, [])
      const props = getAriaProps(grp)

      expect(props).toEqual({})
    })
  })
})
