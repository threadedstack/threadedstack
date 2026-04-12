import { describe, it, expect } from 'vitest'
import type { TBlock, TParsedEvent } from '@TDM/types'
import { PatternMatcherPipeline } from './patternMatcher'
import { claudeCodeMatchers } from './matchers/claudeCode'

describe('PatternMatcherPipeline', () => {
  it('matches output blocks against registered matchers', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: '⏺ Read src/index.ts', timestamp: 1 })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('tool-call')
  })

  it('emits text event for unmatched output', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: 'just regular text', timestamp: 1 })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('text')
    if (events[0].type === 'text') {
      expect(events[0].content).toBe('just regular text')
    }
  })

  it('emits input events for input blocks without pattern matching', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'input', content: 'user typed this', timestamp: 1 })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('input')
  })

  it('uses first matching pattern (priority order)', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: '⏺ Edit src/App.tsx', timestamp: 1 })
    expect(events[0].type).toBe('tool-call')
  })

  it('emits unknown for unmatched output when no matchers registered', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([], (e) => events.push(e))

    pipeline.process({ type: 'output', content: '⏺ Read something', timestamp: 1 })
    expect(events[0].type).toBe('unknown')
    if (events[0].type === 'unknown') {
      expect(events[0].raw).toBe('⏺ Read something')
    }
  })

  it('emits text for unmatched output when matchers are registered', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline(claudeCodeMatchers, (e) => events.push(e))

    pipeline.process({ type: 'output', content: 'just regular text', timestamp: 1 })
    expect(events[0].type).toBe('text')
  })
})
