import type { RGB, TRect } from '@TTH/types/ast.types'

import { describe, it, expect } from 'vitest'
import {
  span,
  textLine,
  panel,
  group,
  selectList,
  selectItem,
  document,
  confirm,
  textInput,
  actionTarget,
  statusBar,
  table,
  tableRow,
  diffBlock,
  link,
  separator,
} from './nodes'

const BLACK: RGB = { r: 0, g: 0, b: 0 }
const WHITE: RGB = { r: 255, g: 255, b: 255 }
const RED: RGB = { r: 255, g: 0, b: 0 }

const ZERO_RECT: TRect = { top: 0, left: 0, bottom: 0, right: 0 }
const RECT: TRect = { top: 0, left: 0, bottom: 10, right: 80 }

describe(`span()`, () => {
  it(`creates a Span with type discriminant`, () => {
    const s = span(`hello`, WHITE, BLACK)
    expect(s.type).toBe(`Span`)
    expect(s.text).toBe(`hello`)
    expect(s.fg).toEqual(WHITE)
    expect(s.bg).toEqual(BLACK)
  })

  it(`defaults all flags to false`, () => {
    const s = span(`test`, WHITE, BLACK)
    expect(s.bold).toBe(false)
    expect(s.italic).toBe(false)
    expect(s.underline).toBe(false)
    expect(s.strikethrough).toBe(false)
    expect(s.faint).toBe(false)
    expect(s.inverse).toBe(false)
  })

  it(`accepts override flags`, () => {
    const s = span(`bold text`, WHITE, BLACK, { bold: true, italic: true })
    expect(s.bold).toBe(true)
    expect(s.italic).toBe(true)
    expect(s.underline).toBe(false)
  })

  it(`accepts partial flag overrides without affecting unspecified flags`, () => {
    const s = span(`underlined`, WHITE, BLACK, { underline: true, faint: true })
    expect(s.underline).toBe(true)
    expect(s.faint).toBe(true)
    expect(s.bold).toBe(false)
    expect(s.italic).toBe(false)
    expect(s.inverse).toBe(false)
  })
})

describe(`textLine()`, () => {
  it(`creates TextLine with children`, () => {
    const s1 = span(`hello `, WHITE, BLACK)
    const s2 = span(`world`, RED, BLACK)
    const line = textLine(RECT, [s1, s2])
    expect(line.type).toBe(`TextLine`)
    expect(line.bounds).toEqual(RECT)
    expect(line.children).toHaveLength(2)
    expect(line.children[0]).toBe(s1)
    expect(line.children[1]).toBe(s2)
  })

  it(`creates TextLine with empty children`, () => {
    const line = textLine(ZERO_RECT, [])
    expect(line.type).toBe(`TextLine`)
    expect(line.children).toHaveLength(0)
  })
})

describe(`panel()`, () => {
  it(`creates Panel with border and no title by default`, () => {
    const p = panel(RECT, [])
    expect(p.type).toBe(`Panel`)
    expect(p.bounds).toEqual(RECT)
    expect(p.border).toBe(`single`)
    expect(p.title).toBeUndefined()
    expect(p.children).toHaveLength(0)
  })

  it(`creates Panel with custom border`, () => {
    const p = panel(RECT, [], `double`)
    expect(p.border).toBe(`double`)
  })

  it(`creates Panel with optional title`, () => {
    const p = panel(RECT, [], `rounded`, `My Panel`)
    expect(p.border).toBe(`rounded`)
    expect(p.title).toBe(`My Panel`)
  })

  it(`creates Panel with children`, () => {
    const line = textLine(RECT, [])
    const p = panel(RECT, [line], `heavy`)
    expect(p.children).toHaveLength(1)
    expect(p.children[0]).toBe(line)
  })
})

describe(`group()`, () => {
  it(`creates Group with bounds and children`, () => {
    const line = textLine(RECT, [])
    const g = group(RECT, [line])
    expect(g.type).toBe(`Group`)
    expect(g.bounds).toEqual(RECT)
    expect(g.children).toHaveLength(1)
  })

  it(`creates empty Group`, () => {
    const g = group(ZERO_RECT, [])
    expect(g.type).toBe(`Group`)
    expect(g.children).toHaveLength(0)
  })
})

describe(`selectItem()`, () => {
  it(`creates SelectItem with index and children`, () => {
    const s = span(`Option A`, WHITE, BLACK)
    const item = selectItem(RECT, 0, [s])
    expect(item.type).toBe(`SelectItem`)
    expect(item.index).toBe(0)
    expect(item.selected).toBe(false)
    expect(item.children).toHaveLength(1)
  })

  it(`creates SelectItem with selected=true`, () => {
    const item = selectItem(RECT, 2, [], true)
    expect(item.selected).toBe(true)
    expect(item.index).toBe(2)
  })
})

describe(`selectList()`, () => {
  it(`creates SelectList with items`, () => {
    const item0 = selectItem(RECT, 0, [])
    const item1 = selectItem(RECT, 1, [], true)
    const list = selectList(RECT, [item0, item1], 1)
    expect(list.type).toBe(`SelectList`)
    expect(list.selectedIndex).toBe(1)
    expect(list.style).toBe(`arrow`)
    expect(list.children).toHaveLength(2)
  })

  it(`creates SelectList with custom style`, () => {
    const list = selectList(RECT, [], 0, `numbered`)
    expect(list.style).toBe(`numbered`)
  })

  it(`defaults selectedIndex to 0`, () => {
    const list = selectList(RECT, [])
    expect(list.selectedIndex).toBe(0)
  })
})

describe(`document()`, () => {
  it(`creates Document with mode and cursor`, () => {
    const doc = document(RECT, [])
    expect(doc.type).toBe(`Document`)
    expect(doc.bounds).toEqual(RECT)
    expect(doc.mode).toBe(`idle`)
    expect(doc.cursor).toEqual({ x: 0, y: 0, visible: false })
    expect(doc.children).toHaveLength(0)
  })

  it(`creates Document with custom mode`, () => {
    const doc = document(RECT, [], `streaming`)
    expect(doc.mode).toBe(`streaming`)
  })

  it(`creates Document with custom cursor`, () => {
    const cursor = { x: 10, y: 5, visible: true }
    const doc = document(RECT, [], `interactive`, cursor)
    expect(doc.cursor).toEqual(cursor)
  })

  it(`creates Document with children`, () => {
    const line = textLine(RECT, [])
    const doc = document(RECT, [line], `tui`)
    expect(doc.children).toHaveLength(1)
    expect(doc.children[0]).toBe(line)
  })
})

describe(`confirm()`, () => {
  it(`creates Confirm with question and options`, () => {
    const c = confirm(RECT, `Are you sure?`, [`Yes`, `No`])
    expect(c.type).toBe(`Confirm`)
    expect(c.question).toBe(`Are you sure?`)
    expect(c.options).toEqual([`Yes`, `No`])
    expect(c.focusedIndex).toBe(0)
  })

  it(`creates Confirm with custom focusedIndex`, () => {
    const c = confirm(RECT, `Delete?`, [`Cancel`, `Delete`], 1)
    expect(c.focusedIndex).toBe(1)
  })
})

describe(`textInput()`, () => {
  it(`creates TextInput with required fields`, () => {
    const ti = textInput(RECT, `> `, `hello`, 5)
    expect(ti.type).toBe(`TextInput`)
    expect(ti.prompt).toBe(`> `)
    expect(ti.value).toBe(`hello`)
    expect(ti.cursorOffset).toBe(5)
    expect(ti.suggestion).toBeUndefined()
  })

  it(`creates TextInput with suggestion`, () => {
    const ti = textInput(RECT, `> `, `hel`, 3, `hello world`)
    expect(ti.suggestion).toBe(`hello world`)
  })
})

describe(`actionTarget()`, () => {
  it(`creates ActionTarget with label and children`, () => {
    const s = span(`Click me`, WHITE, BLACK)
    const at = actionTarget(RECT, `Click me`, [s])
    expect(at.type).toBe(`ActionTarget`)
    expect(at.label).toBe(`Click me`)
    expect(at.focused).toBe(false)
    expect(at.hotkey).toBeUndefined()
    expect(at.children).toHaveLength(1)
  })

  it(`creates ActionTarget with hotkey`, () => {
    const at = actionTarget(RECT, `Submit`, [], true, `Enter`)
    expect(at.focused).toBe(true)
    expect(at.hotkey).toBe(`Enter`)
  })
})

describe(`statusBar()`, () => {
  it(`creates StatusBar with segments`, () => {
    const s = span(`NORMAL`, WHITE, BLACK)
    const sb = statusBar(RECT, [[s]])
    expect(sb.type).toBe(`StatusBar`)
    expect(sb.segments).toHaveLength(1)
    expect(sb.segments[0][0]).toBe(s)
  })
})

describe(`table()`, () => {
  it(`creates Table with rows`, () => {
    const row = tableRow(RECT, [[span(`cell`, WHITE, BLACK)]])
    const t = table(RECT, [row])
    expect(t.type).toBe(`Table`)
    expect(t.hasHeader).toBe(false)
    expect(t.children).toHaveLength(1)
  })

  it(`creates Table with hasHeader=true`, () => {
    const t = table(RECT, [], true)
    expect(t.hasHeader).toBe(true)
  })
})

describe(`tableRow()`, () => {
  it(`creates TableRow with cells`, () => {
    const cells = [[span(`A`, WHITE, BLACK)], [span(`B`, WHITE, BLACK)]]
    const row = tableRow(RECT, cells)
    expect(row.type).toBe(`TableRow`)
    expect(row.isHeader).toBe(false)
    expect(row.cells).toHaveLength(2)
  })

  it(`creates header TableRow`, () => {
    const row = tableRow(RECT, [], true)
    expect(row.isHeader).toBe(true)
  })
})

describe(`diffBlock()`, () => {
  it(`creates DiffBlock with text lines`, () => {
    const line = textLine(RECT, [span(`+added`, RED, BLACK)])
    const db = diffBlock(RECT, [line])
    expect(db.type).toBe(`DiffBlock`)
    expect(db.children).toHaveLength(1)
    expect(db.children[0]).toBe(line)
  })
})

describe(`link()`, () => {
  it(`creates Link with hyperlinkId and children`, () => {
    const s = span(`click here`, WHITE, BLACK)
    const l = link(RECT, 42, [s])
    expect(l.type).toBe(`Link`)
    expect(l.hyperlinkId).toBe(42)
    expect(l.url).toBeUndefined()
    expect(l.children).toHaveLength(1)
  })

  it(`creates Link with URL`, () => {
    const l = link(RECT, 1, [], `https://example.com`)
    expect(l.url).toBe(`https://example.com`)
  })
})

describe(`separator()`, () => {
  it(`creates Separator with default line style`, () => {
    const s = separator(RECT)
    expect(s.type).toBe(`Separator`)
    expect(s.style).toBe(`line`)
  })

  it(`creates Separator with blank style`, () => {
    const s = separator(RECT, `blank`)
    expect(s.style).toBe(`blank`)
  })

  it(`creates Separator with dashed style`, () => {
    const s = separator(RECT, `dashed`)
    expect(s.style).toBe(`dashed`)
  })
})
