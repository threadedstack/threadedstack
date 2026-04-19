import { describe, it, expect } from 'vitest'
import { buildTestViewport } from './decode'
import { classifyCells } from './classify'
import { traceBorders } from './borders'
import type { TPalette } from './types'

const defaultPalette: TPalette = {
  defaultBg: { r: 0, g: 0, b: 0 },
  defaultFg: { r: 200, g: 200, b: 200 },
}

// Helper: fill a viewport with a row of characters starting at (row, col)
type FillSpec = { row: number; col: number; text: string }

function buildFilledViewport(cols: number, rows: number, fills: FillSpec[]) {
  const expanded = fills.flatMap(({ row, col, text }) =>
    [...text].map((ch, i) => ({ row, col: col + i, text: ch }))
  )
  return buildTestViewport(cols, rows, expanded)
}

describe('traceBorders', () => {
  describe('single-border rectangle', () => {
    it('detects a simple 4×3 single-border rectangle (┌──┐ / │  │ / └──┘)', () => {
      // Layout (cols=4, rows=3):
      //   ┌──┐
      //   │  │
      //   └──┘
      const { view, cols, rows } = buildFilledViewport(4, 3, [
        { row: 0, col: 0, text: '┌──┐' },
        { row: 1, col: 0, text: '│  │' },
        { row: 2, col: 0, text: '└──┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(1)
      expect(frames[0].type).toBe('BorderFrame')
      expect(frames[0].bounds).toEqual({ top: 0, left: 0, bottom: 2, right: 3 })
    })

    it('detects a single-border rectangle inside a larger viewport', () => {
      // 8 cols × 5 rows, rectangle at cols 2-6, rows 1-3
      //   cols: 01234567
      // row 0:  (empty)
      // row 1:    ┌───┐
      // row 2:    │   │
      // row 3:    └───┘
      // row 4:  (empty)
      const { view, cols, rows } = buildFilledViewport(8, 5, [
        { row: 1, col: 2, text: '┌───┐' },
        { row: 2, col: 2, text: '│   │' },
        { row: 3, col: 2, text: '└───┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(1)
      expect(frames[0].bounds).toEqual({ top: 1, left: 2, bottom: 3, right: 6 })
    })

    it('produces correct interior and style for the frame', () => {
      const { view, cols, rows } = buildFilledViewport(4, 3, [
        { row: 0, col: 0, text: '┌──┐' },
        { row: 1, col: 0, text: '│  │' },
        { row: 2, col: 0, text: '└──┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames[0].interior).toEqual({ top: 1, left: 1, bottom: 1, right: 2 })
      expect(frames[0].style).toBe('single')
      expect(frames[0].title).toBeUndefined()
    })
  })

  describe('rounded-border rectangle', () => {
    it('detects a rounded-border rectangle (╭──╮ / │  │ / ╰──╯)', () => {
      // Layout (cols=4, rows=3)
      const { view, cols, rows } = buildFilledViewport(4, 3, [
        { row: 0, col: 0, text: '╭──╮' },
        { row: 1, col: 0, text: '│  │' },
        { row: 2, col: 0, text: '╰──╯' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(1)
      expect(frames[0].type).toBe('BorderFrame')
      expect(frames[0].bounds).toEqual({ top: 0, left: 0, bottom: 2, right: 3 })
    })

    it('produces style=rounded for rounded border', () => {
      const { view, cols, rows } = buildFilledViewport(4, 3, [
        { row: 0, col: 0, text: '╭──╮' },
        { row: 1, col: 0, text: '│  │' },
        { row: 2, col: 0, text: '╰──╯' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames[0].style).toBe('rounded')
      expect(frames[0].interior).toEqual({ top: 1, left: 1, bottom: 1, right: 2 })
    })
  })

  describe('title text in top border', () => {
    it('detects frame with title text in top border (┌─Title─┐)', () => {
      // Layout (cols=9, rows=3):
      //   ┌─Title─┐
      //   │       │
      //   └───────┘
      const { view, cols, rows } = buildFilledViewport(9, 3, [
        { row: 0, col: 0, text: '┌─Title─┐' },
        { row: 1, col: 0, text: '│       │' },
        { row: 2, col: 0, text: '└───────┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(1)
      expect(frames[0].bounds).toEqual({ top: 0, left: 0, bottom: 2, right: 8 })
    })

    it('extracts title string from the top border', () => {
      const { view, cols, rows } = buildFilledViewport(9, 3, [
        { row: 0, col: 0, text: '┌─Title─┐' },
        { row: 1, col: 0, text: '│       │' },
        { row: 2, col: 0, text: '└───────┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames[0].title).toBe('Title')
    })
  })

  describe('empty / no borders', () => {
    it('returns empty array for a blank viewport', () => {
      const { view, cols, rows } = buildTestViewport(8, 4)
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(0)
    })

    it('returns empty array when only horizontal lines exist (no corners)', () => {
      const { view, cols, rows } = buildFilledViewport(6, 1, [
        { row: 0, col: 0, text: '──────' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(0)
    })

    it('returns empty array for incomplete rectangle (no bottom border)', () => {
      // Missing bottom border
      const { view, cols, rows } = buildFilledViewport(4, 3, [
        { row: 0, col: 0, text: '┌──┐' },
        { row: 1, col: 0, text: '│  │' },
        // row 2 is blank — no bottom border
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(0)
    })
  })

  describe('nested frames', () => {
    it('detects outer and inner frames in a nested layout', () => {
      // 8 cols × 6 rows:
      //   ┌──────┐
      //   │┌────┐│
      //   ││    ││
      //   ││    ││
      //   │└────┘│
      //   └──────┘
      const { view, cols, rows } = buildFilledViewport(8, 6, [
        { row: 0, col: 0, text: '┌──────┐' },
        { row: 1, col: 0, text: '│┌────┐│' },
        { row: 2, col: 0, text: '││    ││' },
        { row: 3, col: 0, text: '││    ││' },
        { row: 4, col: 0, text: '│└────┘│' },
        { row: 5, col: 0, text: '└──────┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      // Should find at least 2 frames (outer + inner)
      expect(frames.length).toBeGreaterThanOrEqual(2)

      const outer = frames.find(
        (f) =>
          f.bounds.top === 0 &&
          f.bounds.left === 0 &&
          f.bounds.bottom === 5 &&
          f.bounds.right === 7
      )
      expect(outer).toBeDefined()

      const inner = frames.find(
        (f) =>
          f.bounds.top === 1 &&
          f.bounds.left === 1 &&
          f.bounds.bottom === 4 &&
          f.bounds.right === 6
      )
      expect(inner).toBeDefined()
    })
  })

  describe('double-border rectangle', () => {
    it('detects a double-border rectangle (╔══╗ / ║  ║ / ╚══╝)', () => {
      const { view, cols, rows } = buildFilledViewport(4, 3, [
        { row: 0, col: 0, text: '╔══╗' },
        { row: 1, col: 0, text: '║  ║' },
        { row: 2, col: 0, text: '╚══╝' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames).toHaveLength(1)
      expect(frames[0].type).toBe('BorderFrame')
      expect(frames[0].bounds).toEqual({ top: 0, left: 0, bottom: 2, right: 3 })
    })
  })

  describe('scopeBounds', () => {
    it('only detects frames within the given scope', () => {
      // Two rectangles side by side — left at cols 0-3, right at cols 5-8
      const { view, cols, rows } = buildFilledViewport(10, 3, [
        { row: 0, col: 0, text: '┌──┐' },
        { row: 1, col: 0, text: '│  │' },
        { row: 2, col: 0, text: '└──┘' },
        { row: 0, col: 5, text: '┌──┐' },
        { row: 1, col: 5, text: '│  │' },
        { row: 2, col: 5, text: '└──┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)

      // Only scan the right half
      const frames = traceBorders(view, cols, rows, meta, {
        top: 0,
        left: 5,
        bottom: 2,
        right: 9,
      })

      expect(frames).toHaveLength(1)
      expect(frames[0].bounds.left).toBe(5)
    })

    it('detects both frames when no scope is provided', () => {
      const { view, cols, rows } = buildFilledViewport(10, 3, [
        { row: 0, col: 0, text: '┌──┐' },
        { row: 1, col: 0, text: '│  │' },
        { row: 2, col: 0, text: '└──┘' },
        { row: 0, col: 5, text: '┌──┐' },
        { row: 1, col: 5, text: '│  │' },
        { row: 2, col: 5, text: '└──┘' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const frames = traceBorders(view, cols, rows, meta)

      expect(frames.length).toBeGreaterThanOrEqual(2)
    })
  })
})
