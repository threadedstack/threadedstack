import { describe, it, expect } from 'vitest'
import { deriveToolState } from './deriveToolState'
import type { TParsedEvent } from '@TDM/types/parser.types'

describe('deriveToolState', () => {
  const ts = Date.now()

  it('returns working for tool-call events', () => {
    const event: TParsedEvent = {
      type: 'tool-call',
      tool: 'Bash',
      target: '/tmp',
      status: 'running',
      timestamp: ts,
    }
    expect(deriveToolState(event)).toBe('working')
  })

  it('returns working for text events without Bash context', () => {
    const event: TParsedEvent = { type: 'text', content: 'hello', timestamp: ts }
    expect(deriveToolState(event)).toBe('working')
  })

  it('returns interactive for text events with Bash as last running tool', () => {
    const event: TParsedEvent = { type: 'text', content: 'hello', timestamp: ts }
    expect(deriveToolState(event, { lastRunningTool: 'Bash' })).toBe('interactive')
  })

  it('returns interactive for diff events with Bash as last running tool', () => {
    const event: TParsedEvent = {
      type: 'diff',
      file: '',
      additions: [],
      removals: [],
      timestamp: ts,
    }
    expect(deriveToolState(event, { lastRunningTool: 'Bash' })).toBe('interactive')
  })

  it('returns working for activity events', () => {
    const event: TParsedEvent = { type: 'activity', timestamp: ts }
    expect(deriveToolState(event)).toBe('working')
  })

  it('returns null for input events (no state change)', () => {
    const event: TParsedEvent = {
      type: 'input',
      content: 'ls',
      userId: 'u1',
      timestamp: ts,
    }
    expect(deriveToolState(event)).toBeNull()
  })

  it('returns permission for permission events', () => {
    const event: TParsedEvent = { type: 'permission', prompt: 'Allow?', timestamp: ts }
    expect(deriveToolState(event)).toBe('permission')
  })

  it('returns prompt for prompt-ready events', () => {
    const event: TParsedEvent = { type: 'prompt-ready', timestamp: ts }
    expect(deriveToolState(event)).toBe('prompt')
  })

  it('returns prompt for error events', () => {
    const event: TParsedEvent = { type: 'error', message: 'fail', timestamp: ts }
    expect(deriveToolState(event)).toBe('prompt')
  })

  it('returns null for unknown events', () => {
    const event: TParsedEvent = { type: 'unknown', raw: '???', timestamp: ts }
    expect(deriveToolState(event)).toBeNull()
  })
})
