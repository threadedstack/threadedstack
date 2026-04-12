import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TerminalParser } from './terminalParser'
import type { TParsedEvent, TToolState } from '@TDM/types'

describe('TerminalParser', () => {
  let events: TParsedEvent[]
  let toolStates: TToolState[]
  let parser: TerminalParser

  beforeEach(() => {
    events = []
    toolStates = []
    parser = new TerminalParser({
      runtime: 'claude-code',
      onEvent: (e) => events.push(e),
      onToolState: (s) => toolStates.push(s),
      debounceMs: 0, // no debounce for tests
    })
  })

  it('parses plain text output into text events', () => {
    parser.write('Hello world\n')
    parser.flush()
    expect(events.length).toBeGreaterThanOrEqual(1)
    const textEvents = events.filter((e) => e.type === 'text')
    expect(textEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('strips ANSI before parsing', () => {
    parser.write('\x1b[32mGreen text\x1b[0m\n')
    parser.flush()
    const textEvent = events.find((e) => e.type === 'text')
    expect(textEvent).toBeDefined()
    if (textEvent?.type === 'text') {
      expect(textEvent.content).not.toContain('\x1b')
      expect(textEvent.content).toContain('Green text')
    }
  })

  it('detects Claude Code tool calls', () => {
    parser.write('⏺ Read src/index.ts\n')
    parser.flush()
    const toolCall = events.find((e) => e.type === 'tool-call')
    expect(toolCall).toBeDefined()
  })

  it('detects permission prompts and updates tool state', () => {
    parser.write('Allow Edit to src/App.tsx? (y/n)\n')
    parser.flush()
    const permission = events.find((e) => e.type === 'permission')
    expect(permission).toBeDefined()
    expect(toolStates).toContain('permission')
  })

  it('marks input blocks when stdin is tracked', () => {
    parser.trackInput('hello world')
    parser.write('hello world\n')
    parser.flush()
    const inputEvent = events.find((e) => e.type === 'input')
    expect(inputEvent).toBeDefined()
  })

  it('transitions to working state on output', () => {
    parser.write('⏺ Read src/index.ts\n')
    parser.flush()
    expect(toolStates).toContain('working')
  })

  it('transitions to prompt state on prompt-ready', () => {
    parser.write('> \n')
    parser.flush()
    expect(toolStates).toContain('prompt')
  })

  it('falls back to unknown for non-claude-code runtimes', () => {
    const customParser = new TerminalParser({
      runtime: 'custom',
      onEvent: (e) => events.push(e),
      onToolState: (s) => toolStates.push(s),
      debounceMs: 0,
    })
    customParser.write('⏺ Read src/index.ts\n')
    customParser.flush()
    const unknownEvent = events.find((e) => e.type === 'unknown')
    expect(unknownEvent).toBeDefined()
    if (unknownEvent?.type === 'unknown') {
      expect(unknownEvent.raw).toContain('Read')
    }
  })

  it('provides raw bytes buffer for terminal replay', () => {
    const data = '⏺ Read src/index.ts\nsome output\n'
    parser.write(data)
    const raw = parser.getRawBuffer()
    expect(raw).toContain(data)
  })

  describe('tool-call completion', () => {
    it('emits tool-call done when a new tool-call arrives', () => {
      parser.write('⏺ Read src/index.ts\n')
      parser.write('file contents here\n')
      parser.write('⏺ Edit src/index.ts\n')
      parser.flush()

      const toolCalls = events.filter((e) => e.type === 'tool-call')
      const doneEvents = toolCalls.filter(
        (e) => e.type === 'tool-call' && e.status === 'done'
      )
      expect(doneEvents.length).toBeGreaterThanOrEqual(1)
      if (doneEvents[0]?.type === 'tool-call') {
        expect(doneEvents[0].tool).toBe('Read')
      }
    })

    it('emits tool-call done when prompt-ready arrives', () => {
      parser.write('⏺ Read src/index.ts\n')
      parser.write('file contents\n')
      parser.write('> \n')
      parser.flush()

      const doneEvents = events.filter(
        (e) => e.type === 'tool-call' && e.status === 'done'
      )
      expect(doneEvents.length).toBeGreaterThanOrEqual(1)
    })

    it('emits tool-call done on flush if still running', () => {
      parser.write('⏺ Read src/index.ts\n')
      parser.flush()

      const doneEvents = events.filter(
        (e) => e.type === 'tool-call' && e.status === 'done'
      )
      expect(doneEvents.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('thinking detection', () => {
    it('emits thinking event after silence following input', async () => {
      const timedParser = new TerminalParser({
        runtime: 'claude-code',
        onEvent: (e) => events.push(e),
        onToolState: (s) => toolStates.push(s),
        debounceMs: 0,
        thinkingDelayMs: 50, // short delay for test
      })

      timedParser.trackInput('hello')
      await new Promise((resolve) => setTimeout(resolve, 80))

      const thinkingEvent = events.find((e) => e.type === 'thinking')
      expect(thinkingEvent).toBeDefined()
      expect(toolStates).toContain('working')
    })

    it('cancels thinking timer when output arrives', async () => {
      const timedParser = new TerminalParser({
        runtime: 'claude-code',
        onEvent: (e) => events.push(e),
        onToolState: (s) => toolStates.push(s),
        debounceMs: 0,
        thinkingDelayMs: 100,
      })

      timedParser.trackInput('hello')
      // Output arrives before thinking delay
      timedParser.write('response\n')
      timedParser.flush()

      await new Promise((resolve) => setTimeout(resolve, 150))

      const thinkingEvent = events.find((e) => e.type === 'thinking')
      expect(thinkingEvent).toBeUndefined()
    })
  })

  describe('interactive state', () => {
    it('transitions to interactive when Bash tool produces text output', () => {
      parser.write('⏺ Bash npm start\n')
      parser.write('Server listening on port 3000\n')
      parser.flush()

      expect(toolStates).toContain('interactive')
    })

    it('does not transition to interactive for non-Bash tools', () => {
      parser.write('⏺ Read src/index.ts\n')
      parser.write('file contents here\n')
      parser.flush()

      expect(toolStates).not.toContain('interactive')
      expect(toolStates).toContain('working')
    })
  })
})
