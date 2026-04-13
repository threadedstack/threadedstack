import { describe, it, expect } from 'vitest'
import type { TParsedEvent, TPatternMatcher } from '@TDM/types'
import { PatternMatcherPipeline } from './patternMatcher'

const mockMatcher: TPatternMatcher = {
  name: `test-matcher`,
  match: (text: string) => {
    if (text.startsWith(`MATCH:`)) {
      return { type: `text`, content: text.slice(6), timestamp: Date.now() }
    }
    return null
  },
}

describe('PatternMatcherPipeline', () => {
  it('emits matched event on first matching pattern', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([mockMatcher], (e) => events.push(e))

    pipeline.process(`MATCH:hello`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`text`)
  })

  it('falls back to text event when no matcher hits', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([mockMatcher], (e) => events.push(e))

    pipeline.process(`no match here`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`text`)
    if (events[0].type === `text`) {
      expect(events[0].content).toBe(`no match here`)
    }
  })

  it('emits unknown event when no matchers registered', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([], (e) => events.push(e))

    pipeline.process(`anything`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`unknown`)
  })

  it('stops at first matching matcher (priority order)', () => {
    const events: TParsedEvent[] = []
    const secondMatcher: TPatternMatcher = {
      name: `second`,
      match: () => ({
        type: `error`,
        message: `should not reach`,
        timestamp: Date.now(),
      }),
    }
    const pipeline = new PatternMatcherPipeline([mockMatcher, secondMatcher], (e) =>
      events.push(e)
    )

    pipeline.process(`MATCH:first wins`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`text`)
  })
})
