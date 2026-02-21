import { describe, it, expect } from 'vitest'
import {
  positionFromOffset,
  offsetFromPosition,
  findWordBoundaryLeft,
  findWordBoundaryRight,
} from './useEditorState'

describe(`positionFromOffset`, () => {
  it(`returns row 0 col 0 for offset 0`, () => {
    expect(positionFromOffset(`hello`, 0)).toEqual({ row: 0, col: 0 })
  })

  it(`returns correct position in single line`, () => {
    expect(positionFromOffset(`hello`, 3)).toEqual({ row: 0, col: 3 })
  })

  it(`returns correct position at end of single line`, () => {
    expect(positionFromOffset(`hello`, 5)).toEqual({ row: 0, col: 5 })
  })

  it(`returns correct position on second line`, () => {
    expect(positionFromOffset(`ab\ncd`, 4)).toEqual({ row: 1, col: 1 })
  })

  it(`returns correct position at start of second line`, () => {
    expect(positionFromOffset(`ab\ncd`, 3)).toEqual({ row: 1, col: 0 })
  })

  it(`handles position right after newline char`, () => {
    // offset 2 is the \n itself, offset 3 is start of next line
    expect(positionFromOffset(`ab\ncd`, 2)).toEqual({ row: 0, col: 2 })
  })

  it(`handles three lines`, () => {
    expect(positionFromOffset(`ab\ncd\nef`, 7)).toEqual({ row: 2, col: 1 })
  })

  it(`handles empty lines`, () => {
    expect(positionFromOffset(`a\n\nb`, 2)).toEqual({ row: 1, col: 0 })
    expect(positionFromOffset(`a\n\nb`, 3)).toEqual({ row: 2, col: 0 })
  })

  it(`handles empty string`, () => {
    expect(positionFromOffset(``, 0)).toEqual({ row: 0, col: 0 })
  })
})

describe(`offsetFromPosition`, () => {
  it(`returns 0 for row 0 col 0`, () => {
    expect(offsetFromPosition([`hello`], 0, 0)).toBe(0)
  })

  it(`returns correct offset in single line`, () => {
    expect(offsetFromPosition([`hello`], 0, 3)).toBe(3)
  })

  it(`returns correct offset on second line`, () => {
    expect(offsetFromPosition([`ab`, `cd`], 1, 1)).toBe(4)
  })

  it(`returns correct offset on third line`, () => {
    expect(offsetFromPosition([`ab`, `cd`, `ef`], 2, 1)).toBe(7)
  })

  it(`handles empty lines`, () => {
    expect(offsetFromPosition([`a`, ``, `b`], 2, 0)).toBe(3)
  })

  it(`round-trips with positionFromOffset`, () => {
    const text = `hello\nworld\nfoo`
    const lines = text.split(`\n`)
    for (let offset = 0; offset <= text.length; offset++) {
      const pos = positionFromOffset(text, offset)
      const result = offsetFromPosition(lines, pos.row, pos.col)
      expect(result).toBe(offset)
    }
  })
})

describe(`findWordBoundaryLeft`, () => {
  it(`returns 0 when cursor is 0`, () => {
    expect(findWordBoundaryLeft(`hello`, 0)).toBe(0)
  })

  it(`moves to start of current word`, () => {
    expect(findWordBoundaryLeft(`hello world`, 8)).toBe(6)
  })

  it(`skips whitespace then word`, () => {
    expect(findWordBoundaryLeft(`hello world`, 6)).toBe(0)
  })

  it(`handles cursor at end of text`, () => {
    expect(findWordBoundaryLeft(`hello world`, 11)).toBe(6)
  })

  it(`handles single word`, () => {
    expect(findWordBoundaryLeft(`hello`, 5)).toBe(0)
  })

  it(`handles multiple spaces`, () => {
    expect(findWordBoundaryLeft(`a   b`, 4)).toBe(0)
  })

  it(`handles punctuation as non-word`, () => {
    expect(findWordBoundaryLeft(`foo.bar`, 7)).toBe(4)
  })
})

describe(`findWordBoundaryRight`, () => {
  it(`returns text length when cursor is at end`, () => {
    expect(findWordBoundaryRight(`hello`, 5)).toBe(5)
  })

  it(`moves past current word and following space`, () => {
    expect(findWordBoundaryRight(`hello world`, 0)).toBe(6)
  })

  it(`moves from space to end of next word`, () => {
    expect(findWordBoundaryRight(`hello world`, 5)).toBe(6)
  })

  it(`handles cursor at start of second word`, () => {
    expect(findWordBoundaryRight(`hello world`, 6)).toBe(11)
  })

  it(`handles single word`, () => {
    expect(findWordBoundaryRight(`hello`, 0)).toBe(5)
  })

  it(`handles punctuation as non-word`, () => {
    expect(findWordBoundaryRight(`foo.bar`, 0)).toBe(4)
  })
})
