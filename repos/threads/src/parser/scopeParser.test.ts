import { describe, it, expect } from 'vitest'
import { parseScopes } from './scopeParser'
import type { TToken, TBorderFrame, TTextRun, TRawSpan } from '../tokenizer/types'
import type { TRect } from '../ast'

const defaultCursor = { x: 0, y: 0, visible: false }
const rootBounds: TRect = { top: 0, left: 0, bottom: 23, right: 79 }

function makeFrame(
  top: number,
  left: number,
  bottom: number,
  right: number,
  style: TBorderFrame['style'] = 'single',
  title?: string
): TBorderFrame {
  return {
    type: 'BorderFrame',
    bounds: { top, left, bottom, right },
    interior: { top: top + 1, left: left + 1, bottom: bottom - 1, right: right - 1 },
    style,
    ...(title !== undefined ? { title } : {}),
  }
}

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

describe('parseScopes', () => {
  it('returns no panels and all tokens as remaining when no frames exist', () => {
    const tokens: TToken[] = [
      makeTextRun(0, 0, 'Hello world'),
      makeTextRun(1, 0, 'Second line'),
    ]
    const { panels, remaining } = parseScopes(tokens, rootBounds, defaultCursor)
    expect(panels).toHaveLength(0)
    expect(remaining).toHaveLength(2)
  })

  it('wraps a BorderFrame into a Panel with interior text as children', () => {
    const frame = makeFrame(0, 0, 4, 20)
    const interiorText = makeTextRun(2, 3, 'Inside')
    const tokens: TToken[] = [frame, interiorText]

    const { panels, remaining } = parseScopes(tokens, rootBounds, defaultCursor)

    expect(panels).toHaveLength(1)
    expect(panels[0].type).toBe('Panel')
    expect(panels[0].border).toBe('single')
    expect(panels[0].bounds).toEqual(frame.bounds)
    // Interior text should become children (parsed as flat content)
    expect(panels[0].children.length).toBeGreaterThan(0)
    // Interior text should not appear in remaining
    expect(remaining).toHaveLength(0)
  })

  it('preserves frame title on the Panel node', () => {
    const frame = makeFrame(0, 0, 4, 20, 'double', 'My Panel')
    const tokens: TToken[] = [frame]

    const { panels } = parseScopes(tokens, rootBounds, defaultCursor)

    expect(panels).toHaveLength(1)
    expect(panels[0].title).toBe('My Panel')
    expect(panels[0].border).toBe('double')
  })

  it('tokens outside frames are returned as remaining', () => {
    const frame = makeFrame(0, 0, 4, 20)
    const outsideText = makeTextRun(10, 0, 'Outside')
    const tokens: TToken[] = [frame, outsideText]

    const { panels, remaining } = parseScopes(tokens, rootBounds, defaultCursor)

    expect(panels).toHaveLength(1)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toBe(outsideText)
  })

  it('handles nested frames by only creating top-level panels', () => {
    // Outer frame: rows 0-10, cols 0-40
    const outerFrame = makeFrame(0, 0, 10, 40)
    // Nested frame: rows 2-8, cols 3-20 (inside outer interior)
    const innerFrame = makeFrame(2, 3, 8, 20)
    // Text inside inner frame
    const innerText = makeTextRun(4, 5, 'Nested')
    // Text outside both frames
    const outsideText = makeTextRun(15, 0, 'Outside')

    const tokens: TToken[] = [outerFrame, innerFrame, innerText, outsideText]

    const { panels, remaining } = parseScopes(tokens, rootBounds, defaultCursor)

    // Only the outer frame should produce a top-level panel
    expect(panels).toHaveLength(1)
    expect(panels[0].bounds).toEqual(outerFrame.bounds)
    // The inner frame should be recursively parsed as a nested panel
    const nestedPanels = panels[0].children.filter((c) => c.type === 'Panel')
    expect(nestedPanels).toHaveLength(1)
    // Remaining should only have the outside text
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toBe(outsideText)
  })

  it('handles multiple sibling frames', () => {
    const frame1 = makeFrame(0, 0, 4, 20)
    const frame2 = makeFrame(6, 0, 10, 20)
    const text1 = makeTextRun(2, 3, 'Panel 1')
    const text2 = makeTextRun(8, 3, 'Panel 2')
    const outsideText = makeTextRun(12, 0, 'Footer')

    const tokens: TToken[] = [frame1, frame2, text1, text2, outsideText]

    const { panels, remaining } = parseScopes(tokens, rootBounds, defaultCursor)

    expect(panels).toHaveLength(2)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toBe(outsideText)
  })

  it('handles empty frames (no interior tokens)', () => {
    const frame = makeFrame(0, 0, 4, 20)
    const tokens: TToken[] = [frame]

    const { panels, remaining } = parseScopes(tokens, rootBounds, defaultCursor)

    expect(panels).toHaveLength(1)
    expect(panels[0].children).toHaveLength(0)
    expect(remaining).toHaveLength(0)
  })
})
