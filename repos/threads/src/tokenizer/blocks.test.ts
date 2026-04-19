import { describe, it, expect } from 'vitest'
import { buildTestViewport } from './decode'
import { classifyCells } from './classify'
import { segmentBlocks } from './blocks'
import type { TPalette } from './types'
import type { TRect } from '../ast/types'

// Non-black background to trigger isHighlighted
const highlightBg = { r: 50, g: 100, b: 200 }

const defaultPalette: TPalette = {
  defaultBg: { r: 0, g: 0, b: 0 },
  defaultFg: { r: 200, g: 200, b: 200 },
}

describe('segmentBlocks', () => {
  describe('full-width highlighted block', () => {
    it('detects a full-width single-row block spanning the entire scope width', () => {
      // 6 cols × 3 rows — row 1 is fully highlighted (bg != defaultBg)
      const { view, cols, rows } = buildTestViewport(6, 3, [
        { row: 1, col: 0, text: ' ', bg: highlightBg },
        { row: 1, col: 1, text: ' ', bg: highlightBg },
        { row: 1, col: 2, text: ' ', bg: highlightBg },
        { row: 1, col: 3, text: ' ', bg: highlightBg },
        { row: 1, col: 4, text: ' ', bg: highlightBg },
        { row: 1, col: 5, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
      const scopeWidth = cols // 6

      const blocks = segmentBlocks(meta, scope, scopeWidth)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('HighlightedBlock')
      expect(blocks[0].shape).toBe('full-width')
      expect(blocks[0].bounds).toEqual({ top: 1, left: 0, bottom: 1, right: 5 })
    })

    it('classifies a partial-width single-row block as small', () => {
      // 6 cols × 1 row — cols 1-3 highlighted (width 3 < 6 scopeWidth)
      const { view, cols, rows } = buildTestViewport(6, 1, [
        { row: 0, col: 1, text: ' ', bg: highlightBg },
        { row: 0, col: 2, text: ' ', bg: highlightBg },
        { row: 0, col: 3, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
      const scopeWidth = cols // 6

      const blocks = segmentBlocks(meta, scope, scopeWidth)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].shape).toBe('small')
    })
  })

  describe('small highlighted block', () => {
    it('detects a single-cell highlighted block as small', () => {
      const { view, cols, rows } = buildTestViewport(8, 4, [
        { row: 2, col: 3, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
      const scopeWidth = cols

      const blocks = segmentBlocks(meta, scope, scopeWidth)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('HighlightedBlock')
      expect(blocks[0].shape).toBe('small')
      expect(blocks[0].bounds).toEqual({ top: 2, left: 3, bottom: 2, right: 3 })
    })

    it('detects a small multi-cell block in the middle of a viewport', () => {
      const { view, cols, rows } = buildTestViewport(10, 5, [
        { row: 1, col: 2, text: ' ', bg: highlightBg },
        { row: 1, col: 3, text: ' ', bg: highlightBg },
        { row: 1, col: 4, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
      const scopeWidth = cols

      const blocks = segmentBlocks(meta, scope, scopeWidth)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].shape).toBe('small')
      expect(blocks[0].bounds).toEqual({ top: 1, left: 2, bottom: 1, right: 4 })
    })
  })

  describe('multi-row highlighted block', () => {
    it('detects a multi-row block spanning two rows', () => {
      const { view, cols, rows } = buildTestViewport(6, 4, [
        { row: 1, col: 1, text: ' ', bg: highlightBg },
        { row: 1, col: 2, text: ' ', bg: highlightBg },
        { row: 2, col: 1, text: ' ', bg: highlightBg },
        { row: 2, col: 2, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
      const scopeWidth = cols

      const blocks = segmentBlocks(meta, scope, scopeWidth)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].shape).toBe('multi-row')
      expect(blocks[0].bounds).toEqual({ top: 1, left: 1, bottom: 2, right: 2 })
    })

    it('classifies multi-row as multi-row even when spanning full width', () => {
      // A highlighted block that is both multi-row and full-width → multi-row takes priority
      const { view, cols, rows } = buildTestViewport(4, 4, [
        { row: 0, col: 0, text: ' ', bg: highlightBg },
        { row: 0, col: 1, text: ' ', bg: highlightBg },
        { row: 0, col: 2, text: ' ', bg: highlightBg },
        { row: 0, col: 3, text: ' ', bg: highlightBg },
        { row: 1, col: 0, text: ' ', bg: highlightBg },
        { row: 1, col: 1, text: ' ', bg: highlightBg },
        { row: 1, col: 2, text: ' ', bg: highlightBg },
        { row: 1, col: 3, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }
      const scopeWidth = cols

      const blocks = segmentBlocks(meta, scope, scopeWidth)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].shape).toBe('multi-row')
    })
  })

  describe('empty / no highlights', () => {
    it('returns empty array for a blank viewport', () => {
      const { view, cols, rows } = buildTestViewport(8, 4)
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const blocks = segmentBlocks(meta, scope, cols)

      expect(blocks).toHaveLength(0)
    })

    it('returns empty array when no cells have a non-default background', () => {
      // Cells have text but default background → not highlighted
      const { view, cols, rows } = buildTestViewport(6, 2, [
        { row: 0, col: 0, text: 'H' },
        { row: 0, col: 1, text: 'i' },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const blocks = segmentBlocks(meta, scope, cols)

      expect(blocks).toHaveLength(0)
    })
  })

  describe('multiple disjoint blocks', () => {
    it('detects two separate highlighted regions as two blocks', () => {
      const { view, cols, rows } = buildTestViewport(10, 3, [
        // Block A: row 1, cols 0-1
        { row: 1, col: 0, text: ' ', bg: highlightBg },
        { row: 1, col: 1, text: ' ', bg: highlightBg },
        // Block B: row 1, cols 7-8 (separated by unhighlighted gap)
        { row: 1, col: 7, text: ' ', bg: highlightBg },
        { row: 1, col: 8, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const blocks = segmentBlocks(meta, scope, cols)

      expect(blocks).toHaveLength(2)
    })
  })

  describe('color placeholder', () => {
    it('sets color to zero-RGB placeholder', () => {
      const { view, cols, rows } = buildTestViewport(4, 2, [
        { row: 0, col: 0, text: ' ', bg: highlightBg },
      ])
      const meta = classifyCells(view, cols, rows, defaultPalette)
      const scope: TRect = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

      const blocks = segmentBlocks(meta, scope, cols)

      expect(blocks[0].color).toEqual({ r: 0, g: 0, b: 0 })
    })
  })
})
