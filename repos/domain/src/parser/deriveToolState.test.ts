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

  it('returns null for unknown events without interactive patterns', () => {
    const event: TParsedEvent = { type: 'unknown', raw: '???', timestamp: ts }
    expect(deriveToolState(event)).toBeNull()
  })

  describe('interactive prompt detection', () => {
    it('detects (y/n) confirmation prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Do you want to continue? (y/n)',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects [Y/n] confirmation prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Proceed with installation? [Y/n]',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects [y/N] confirmation prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Delete all files? [y/N]',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects (yes/no) confirmation prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Are you sure? (yes/no)',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects "press enter" prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Press Enter to continue',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects "enter to continue" prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Enter to continue...',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects "esc to cancel" prompts', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Esc to cancel',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects cursor selection markers', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: '❯ Dark theme',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('detects › selection markers', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: '› Option A',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('interactive prompt takes priority over Bash context', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Continue? (y/n)',
        timestamp: ts,
      }
      // Both interactive pattern AND Bash context — should still be interactive
      expect(deriveToolState(event, { lastRunningTool: 'Bash' })).toBe('interactive')
    })

    it('detects interactive patterns in unknown events', () => {
      const event: TParsedEvent = {
        type: 'unknown',
        raw: 'Continue? (y/n)',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('interactive')
    })

    it('does NOT flag regular text as interactive', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: 'Here is what I found in the codebase',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('working')
    })

    it('does NOT flag numbered lists as interactive', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: '1. Fixed the bug\n2. Updated the tests',
        timestamp: ts,
      }
      expect(deriveToolState(event)).toBe('working')
    })

    it('does NOT flag bare > prompt markers (those are prompt-ready via matchers)', () => {
      const event: TParsedEvent = {
        type: 'text',
        content: '> ',
        timestamp: ts,
      }
      // Bare ">" with just a space isn't ❯ with content after it
      expect(deriveToolState(event)).toBe('working')
    })
  })
})
