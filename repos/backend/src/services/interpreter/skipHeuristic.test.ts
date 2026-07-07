import { describe, it, expect } from 'vitest'
import { shouldInterpret } from './skipHeuristic'
import { EParserEvtType, EToolCallState } from '@tdsk/domain'
import type { TParsedEvent } from '@tdsk/domain'

function textEvent(content: string): TParsedEvent {
  return { type: EParserEvtType.Text, content, timestamp: Date.now() }
}

function unknownEvent(raw: string): TParsedEvent {
  return { type: EParserEvtType.Unknown, raw, timestamp: Date.now() }
}

function toolCallEvent(): TParsedEvent {
  return {
    type: EParserEvtType.ToolCall,
    tool: 'Read',
    target: 'src/index.ts',
    status: EToolCallState.Running,
    timestamp: Date.now(),
  }
}

describe('shouldInterpret', () => {
  it('should return true for numbered list', () => {
    const events = [
      textEvent('Choose an option:'),
      textEvent('1. Redis'),
      textEvent('2. PostgreSQL'),
    ]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for bulleted list', () => {
    const events = [textEvent('- Option A'), textEvent('- Option B')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for cursor markers', () => {
    const events = [unknownEvent('❯ Dark mode'), unknownEvent('  Light mode')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for y/n prompt', () => {
    const events = [textEvent('Continue? (y/n)')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return true for action prompts', () => {
    const events = [textEvent('Allow Edit to src/App.tsx?')]
    expect(shouldInterpret(events)).toBe(true)
  })

  it('should return false for plain prose', () => {
    const events = [textEvent('The function has been updated successfully.')]
    expect(shouldInterpret(events)).toBe(false)
  })

  it('should return false for empty events', () => {
    expect(shouldInterpret([])).toBe(false)
  })

  it('should return false for whitespace-only content', () => {
    const events = [textEvent('   '), textEvent('\n')]
    expect(shouldInterpret(events)).toBe(false)
  })

  it('should ignore non-text event types in pattern matching', () => {
    const events = [toolCallEvent()]
    expect(shouldInterpret(events)).toBe(false)
  })

  it('should return true when mixed events contain interactive text', () => {
    const events = [toolCallEvent(), textEvent('Choose: 1. Yes 2. No')]
    expect(shouldInterpret(events)).toBe(true)
  })
})
