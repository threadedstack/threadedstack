import { describe, it, expect } from 'vitest'
import { getSystemPrompt, buildUserMessage } from './prompt'
import { InterpreterSystem, EParserEvtType, EToolCallState } from '@tdsk/domain'
import type { TParsedEvent, TGuiConfig } from '@tdsk/domain'

const baseConfig: TGuiConfig = {
  enabled: true,
  providerId: 'prov-1',
  model: 'test-model',
  maxRetries: 1,
}

describe('getSystemPrompt', () => {
  it('should return config.systemPrompt when provided and non-empty', () => {
    const config: TGuiConfig = { ...baseConfig, systemPrompt: 'Custom system prompt' }
    expect(getSystemPrompt(config)).toBe('Custom system prompt')
  })

  it('should return InterpreterSystem default when systemPrompt is undefined', () => {
    const config: TGuiConfig = { ...baseConfig, systemPrompt: undefined }
    expect(getSystemPrompt(config)).toBe(InterpreterSystem)
  })

  it('should return InterpreterSystem default when systemPrompt is whitespace-only', () => {
    const config: TGuiConfig = { ...baseConfig, systemPrompt: '   ' }
    expect(getSystemPrompt(config)).toBe(InterpreterSystem)
  })
})

describe('buildUserMessage', () => {
  const ts = Date.now()

  it('should return content for a text event', () => {
    const events: TParsedEvent[] = [
      { type: EParserEvtType.Text, content: 'Hello world', timestamp: ts },
    ]
    expect(buildUserMessage(events)).toBe('Hello world')
  })

  it('should return raw for an unknown event', () => {
    const events: TParsedEvent[] = [
      { type: EParserEvtType.Unknown, raw: 'raw terminal output', timestamp: ts },
    ]
    expect(buildUserMessage(events)).toBe('raw terminal output')
  })

  it('should return "Error: {message}" for an error event', () => {
    const events: TParsedEvent[] = [
      { type: EParserEvtType.Error, message: 'something went wrong', timestamp: ts },
    ]
    expect(buildUserMessage(events)).toBe('Error: something went wrong')
  })

  it('should return "⏺ {tool} {target}" for a tool-call event', () => {
    const events: TParsedEvent[] = [
      {
        type: EParserEvtType.ToolCall,
        tool: 'Read',
        target: 'src/index.ts',
        status: EToolCallState.Running,
        timestamp: ts,
      },
    ]
    expect(buildUserMessage(events)).toBe('⏺ Read src/index.ts')
  })

  it('should return prompt for a permission event', () => {
    const events: TParsedEvent[] = [
      {
        type: EParserEvtType.Permission,
        prompt: 'Allow Edit to src/App.tsx?',
        timestamp: ts,
      },
    ]
    expect(buildUserMessage(events)).toBe('Allow Edit to src/App.tsx?')
  })

  it('should return + and - lines for a diff event', () => {
    const events: TParsedEvent[] = [
      {
        type: EParserEvtType.Diff,
        file: 'src/index.ts',
        additions: ['added line'],
        removals: ['removed line'],
        timestamp: ts,
      },
    ]
    expect(buildUserMessage(events)).toBe('+ added line\n- removed line')
  })

  it('should join multiple events by newline and filter empty strings', () => {
    const events: TParsedEvent[] = [
      { type: EParserEvtType.Text, content: 'First', timestamp: ts },
      { type: EParserEvtType.Text, content: 'Second', timestamp: ts },
    ]
    expect(buildUserMessage(events)).toBe('First\nSecond')
  })

  it('should return empty string for activity events', () => {
    const events: TParsedEvent[] = [{ type: EParserEvtType.Activity, timestamp: ts }]
    expect(buildUserMessage(events)).toBe('')
  })

  it('should return empty string for prompt-ready events', () => {
    const events: TParsedEvent[] = [{ type: EParserEvtType.PromptReady, timestamp: ts }]
    expect(buildUserMessage(events)).toBe('')
  })

  it('should filter out activity and prompt-ready from mixed events', () => {
    const events: TParsedEvent[] = [
      { type: EParserEvtType.Activity, timestamp: ts },
      { type: EParserEvtType.Text, content: 'Visible text', timestamp: ts },
      { type: EParserEvtType.PromptReady, timestamp: ts },
    ]
    expect(buildUserMessage(events)).toBe('Visible text')
  })

  it('should return empty string for an empty array', () => {
    expect(buildUserMessage([])).toBe('')
  })
})
