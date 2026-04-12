import type { TBlock } from '@TDM/types'

import { BlockSegmenter } from './blockSegmenter'
import { describe, it, expect, beforeEach } from 'vitest'

describe('BlockSegmenter', () => {
  let segmenter: BlockSegmenter
  let blocks: TBlock[]

  beforeEach(() => {
    blocks = []
    segmenter = new BlockSegmenter((block) => blocks.push(block))
  })

  it('emits output block on newline-terminated text', () => {
    segmenter.feed('Hello world\n')
    segmenter.flush()
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('output')
    expect(blocks[0].content).toBe('Hello world')
  })

  it('marks text as input when it matches sent stdin', () => {
    segmenter.markSent('hello\n')
    segmenter.feed('hello\n')
    segmenter.flush()
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('input')
    expect(blocks[0].content).toBe('hello')
  })

  it('separates multiple lines into blocks on prompt detection', () => {
    segmenter.feed('output line 1\noutput line 2\n> ')
    segmenter.flush()
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    const outputBlock = blocks.find((b) => b.type === 'output')
    expect(outputBlock).toBeDefined()
  })

  it('detects prompt readiness from > prefix', () => {
    let state = segmenter.getState()
    expect(state).toBe('waiting')
    segmenter.feed('some output\n> ')
    state = segmenter.getState()
    expect(state).toBe('waiting')
  })

  it('transitions to outputting on non-prompt content', () => {
    segmenter.feed('⏺ Read src/index.ts\n')
    expect(segmenter.getState()).toBe('outputting')
  })

  it('buffers partial lines until newline arrives', () => {
    segmenter.feed('partial')
    expect(blocks).toHaveLength(0)
    segmenter.feed(' line\n')
    segmenter.flush()
    expect(blocks).toHaveLength(1)
    expect(blocks[0].content).toBe('partial line')
  })

  it('handles empty input', () => {
    segmenter.feed('')
    segmenter.flush()
    expect(blocks).toHaveLength(0)
  })
})
