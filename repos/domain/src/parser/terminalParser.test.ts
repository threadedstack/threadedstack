import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { TerminalParser } from './terminalParser'
import type { TParsedEvent } from '@TDM/types'

describe('TerminalParser', () => {
  beforeAll(async () => {
    // Ensure WASM is loaded before tests run
    const { GhosttyVT } = await import('./ghosttyVT')
    await GhosttyVT.init()
  })

  let parser: TerminalParser

  afterEach(() => {
    parser?.destroy()
  })

  it('parses plain text output into text events', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Hello world\r\n')
    parser.flush()

    const textEvents = events.filter((e) => e.type === `text`)
    expect(textEvents.length).toBeGreaterThanOrEqual(1)
    if (textEvents[0]?.type === `text`) {
      expect(textEvents[0].content).toContain(`Hello world`)
    }
  })

  it('strips ANSI before pattern matching', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('\x1b[32mGreen text\x1b[0m\r\n')
    parser.flush()

    const textEvent = events.find((e) => e.type === `text`)
    expect(textEvent).toBeDefined()
    if (textEvent?.type === `text`) {
      expect(textEvent.content).not.toContain(`\x1b`)
      expect(textEvent.content).toContain(`Green text`)
    }
  })

  it('detects Claude Code tool calls', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('⏺ Read src/index.ts\r\n')
    parser.flush()

    const toolCall = events.find((e) => e.type === `tool-call`)
    expect(toolCall).toBeDefined()
    if (toolCall?.type === `tool-call`) {
      expect(toolCall.tool).toBe(`Read`)
      expect(toolCall.target).toBe(`src/index.ts`)
    }
  })

  it('detects permission prompts', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Allow Edit to src/App.tsx? (y/n)\r\n')
    parser.flush()

    const permission = events.find((e) => e.type === `permission`)
    expect(permission).toBeDefined()
  })

  it('handles split escape sequences across writes', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('\x1b[36m⏺\x1b[0m \x1b[1mBa')
    parser.write('sh\x1b[0m echo hello\r\n')
    parser.flush()

    const toolCall = events.find((e) => e.type === `tool-call`)
    expect(toolCall).toBeDefined()
    if (toolCall?.type === `tool-call`) {
      expect(toolCall.tool).toBe(`Bash`)
    }
  })

  it('filters CR overwrites — emits only final line', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('⠋ Working...\r⠙ Working...\r✓ Done!\r\n')
    parser.flush()

    // Should get one text event with the final content, not intermediate spinner frames
    const textEvents = events.filter((e) => e.type === `text`)
    expect(textEvents.length).toBe(1)
    if (textEvents[0]?.type === `text`) {
      expect(textEvents[0].content).toMatch(/Done!/)
    }
  })

  it('emits activity when terminal is active but no lines sealed', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Spinner frame')
    // No \r\n — cursor stays on the active row

    const activity = events.find((e) => e.type === `activity`)
    expect(activity).toBeDefined()
  })

  it('falls back to unknown for non-registered runtimes', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `custom`,
      onEvent: (e) => events.push(e),
    })

    parser.write('⏺ Read src/index.ts\r\n')
    parser.flush()

    const unknownEvent = events.find((e) => e.type === `unknown`)
    expect(unknownEvent).toBeDefined()
  })

  it('provides raw bytes buffer for persistence', () => {
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: () => {},
    })

    const data = '⏺ Read src/index.ts\r\nsome output\r\n'
    parser.write(data)
    const raw = parser.getRawBuffer()
    const decoded = new TextDecoder().decode(raw)
    expect(decoded).toContain(data)
  })

  it('emits prompt-ready when prompt arrives in same batch as output', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    // Simulate Claude Code finishing output and showing prompt in one chunk
    parser.write('Some output text\r\n❯ ')

    const promptReady = events.find((e) => e.type === `prompt-ready`)
    expect(promptReady).toBeDefined()
  })

  it('emits prompt-ready when prompt follows multiple output lines', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Line one\r\nLine two\r\nLine three\r\n❯ ')

    const promptReady = events.find((e) => e.type === `prompt-ready`)
    expect(promptReady).toBeDefined()

    // Should also have text events for the output lines
    const textEvents = events.filter((e) => e.type === `text`)
    expect(textEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('emits prompt-ready for $ prompt', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('command output\r\n$ ')

    const promptReady = events.find((e) => e.type === `prompt-ready`)
    expect(promptReady).toBeDefined()
  })

  it('preserves indentation in text events', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('    indented code\r\n')
    parser.flush()

    const textEvent = events.find((e) => e.type === `text`)
    expect(textEvent).toBeDefined()
    if (textEvent?.type === `text`) {
      expect(textEvent.content).toBe(`    indented code`)
    }
  })
})
