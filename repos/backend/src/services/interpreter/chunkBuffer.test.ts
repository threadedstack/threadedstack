import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkBuffer } from './chunkBuffer'
import type { TParsedEvent } from '@tdsk/domain'

function textEvent(content: string): TParsedEvent {
  return { type: 'text', content, timestamp: Date.now() }
}

function promptReadyEvent(): TParsedEvent {
  return { type: 'prompt-ready', timestamp: Date.now() }
}

function activityEvent(): TParsedEvent {
  return { type: 'activity', timestamp: Date.now() }
}

function inputEvent(content: string): TParsedEvent {
  return { type: 'input', content, userId: 'user1', timestamp: Date.now() }
}

describe('ChunkBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should assign chunkId to buffered events', () => {
    const stamped: { event: TParsedEvent; chunkId?: string }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: (event, chunkId) => stamped.push({ event, chunkId }),
      onFlush: () => {},
    })

    buffer.push(textEvent('hello'))
    expect(stamped).toHaveLength(1)
    expect(stamped[0].chunkId).toBeDefined()
    expect(typeof stamped[0].chunkId).toBe('string')
  })

  it('should NOT assign chunkId to bypass events', () => {
    const stamped: { event: TParsedEvent; chunkId?: string }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: (event, chunkId) => stamped.push({ event, chunkId }),
      onFlush: () => {},
    })

    buffer.push(activityEvent())
    buffer.push(inputEvent('test'))
    expect(stamped).toHaveLength(2)
    expect(stamped[0].chunkId).toBeUndefined()
    expect(stamped[1].chunkId).toBeUndefined()
  })

  it('should flush on prompt-ready event', () => {
    const flushed: { chunkId: string; events: TParsedEvent[] }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: (chunkId, events) => {
        flushed.push({ chunkId, events })
      },
    })

    buffer.push(textEvent('line 1'))
    buffer.push(textEvent('line 2'))
    expect(flushed).toHaveLength(0)

    buffer.push(promptReadyEvent())
    expect(flushed).toHaveLength(1)
    expect(flushed[0].events).toHaveLength(2)
    expect(flushed[0].events[0].type).toBe('text')
  })

  it('should flush on debounce timeout', () => {
    const flushed: { chunkId: string; events: TParsedEvent[] }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: (chunkId, events) => {
        flushed.push({ chunkId, events })
      },
    })

    buffer.push(textEvent('line 1'))
    expect(flushed).toHaveLength(0)

    vi.advanceTimersByTime(200)
    expect(flushed).toHaveLength(1)
    expect(flushed[0].events).toHaveLength(1)
  })

  it('should generate new chunkId after flush', () => {
    const stamped: { chunkId?: string }[] = []
    const flushed: { chunkId: string }[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: (_, chunkId) => stamped.push({ chunkId }),
      onFlush: (chunkId) => {
        flushed.push({ chunkId })
      },
    })

    buffer.push(textEvent('chunk 1'))
    buffer.push(promptReadyEvent())
    buffer.push(textEvent('chunk 2'))

    expect(stamped[0].chunkId).toBe(flushed[0].chunkId)
    expect(stamped[1].chunkId).not.toBe(stamped[0].chunkId)
  })

  it('should not flush empty buffer', () => {
    const flushed: unknown[] = []
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: () => {
        flushed.push(1)
      },
    })

    buffer.push(promptReadyEvent())
    expect(flushed).toHaveLength(0)
  })

  it('should clean up timers on destroy', () => {
    const buffer = new ChunkBuffer({
      onStampedEvent: () => {},
      onFlush: () => {},
    })

    buffer.push(textEvent('line'))
    buffer.destroy()
    vi.advanceTimersByTime(300)
    // No error thrown, timer was cleared
  })
})
