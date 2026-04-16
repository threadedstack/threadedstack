import { describe, it, expect } from 'vitest'
import { classifyContent } from './contentFilter'

describe('contentFilter', () => {
  describe('chrome detection (generic)', () => {
    it('detects pipe-heavy status bar lines', () => {
      expect(classifyContent('| glm-5 | API Usage Billing | | /home/sandbox |')).toBe(
        'chrome'
      )
      expect(classifyContent('│ Tab1 │ Tab2 │ Tab3 │')).toBe('chrome')
    })

    it('detects box drawing border lines', () => {
      expect(classifyContent('┌──────────────────────────┐')).toBe('chrome')
      expect(classifyContent('└──────────────────────────┘')).toBe('chrome')
      expect(classifyContent('├──────┤')).toBe('chrome')
      expect(classifyContent('═══════════════')).toBe('chrome')
    })

    it('detects pipe-and-space-only lines', () => {
      expect(classifyContent('│                          │')).toBe('chrome')
      expect(classifyContent('|   |   |')).toBe('chrome')
      expect(classifyContent('───────────')).toBe('chrome')
    })

    it('detects dense keyboard shortcut text', () => {
      expect(
        classifyContent(
          '! for bash mode double tap esc to clear input ctrl + shift + - to / for commands shift + tab to auto-accept'
        )
      ).toBe('chrome')
    })

    it('does NOT suppress normal content with a single pipe', () => {
      expect(classifyContent('foo | bar')).toBe('content')
    })

    it('does NOT suppress normal prose', () => {
      expect(
        classifyContent('This is a paragraph of text with no interactive elements.')
      ).toBe('content')
    })

    it('does NOT suppress code output', () => {
      expect(classifyContent('const x = 42')).toBe('content')
    })

    it('does NOT suppress bullet lists', () => {
      expect(
        classifyContent('  - Read, write, and edit files across your codebase')
      ).toBe('content')
    })
  })

  describe('loading detection (generic)', () => {
    it('detects braille spinner prefixes', () => {
      expect(classifyContent('\u280B Hashing...')).toBe('loading')
      expect(classifyContent('\u2819 Compiling modules...')).toBe('loading')
    })

    it('detects loading verb patterns', () => {
      expect(classifyContent('Loading...')).toBe('loading')
      expect(classifyContent('Hashing...')).toBe('loading')
      expect(classifyContent('Processing...')).toBe('loading')
      expect(classifyContent('Compiling...')).toBe('loading')
      expect(classifyContent('Building...')).toBe('loading')
      expect(classifyContent('Indexing...')).toBe('loading')
      expect(classifyContent('Searching...')).toBe('loading')
      expect(classifyContent('Analyzing...')).toBe('loading')
    })

    it('detects "to interrupt" hint', () => {
      expect(classifyContent('to interrupt')).toBe('loading')
    })

    it('detects "press X to cancel" hints', () => {
      expect(classifyContent('press Ctrl+C to cancel')).toBe('loading')
      expect(classifyContent('press Esc to interrupt')).toBe('loading')
    })

    it('detects "esc to cancel"', () => {
      expect(classifyContent('esc to cancel')).toBe('loading')
    })

    it('does NOT flag "Loading" without ellipsis', () => {
      expect(classifyContent('Loading the configuration from disk')).toBe('content')
    })

    it('does NOT flag normal content with loading words', () => {
      expect(classifyContent('The building was tall')).toBe('content')
    })
  })

  describe('claude-code runtime classifier', () => {
    const rt = 'claude-code'

    it('detects shortcut hint lines', () => {
      expect(classifyContent('? for shortcuts', rt)).toBe('chrome')
      expect(classifyContent('! for bash mode', rt)).toBe('chrome')
    })

    it('detects effort indicator lines', () => {
      expect(classifyContent('● high · /effort', rt)).toBe('chrome')
      expect(classifyContent('• medium · /effort', rt)).toBe('chrome')
    })

    it('detects recent activity status line', () => {
      expect(classifyContent('recent activity | | | glm-5', rt)).toBe('chrome')
    })

    it('detects welcome banner with pipes', () => {
      expect(
        classifyContent('Welcome back! | Run /init to create a CLAUDE.md file', rt)
      ).toBe('chrome')
    })

    it('detects "⊕ Hashing..." patterns', () => {
      expect(classifyContent('⊕ Hashing...', rt)).toBe('loading')
    })

    it('passes through real content', () => {
      expect(
        classifyContent("I'm Claude Code, Anthropic's CLI for software engineering.", rt)
      ).toBe('content')
      expect(
        classifyContent('Read, write, and edit files across your codebase', rt)
      ).toBe('content')
    })

    it('passes through tool call lines (handled by pattern matchers)', () => {
      expect(classifyContent('⏺ Read src/index.ts', rt)).toBe('content')
    })

    it('passes through error lines (handled by pattern matchers)', () => {
      expect(classifyContent('✗ Build failed', rt)).toBe('content')
    })
  })

  describe('unknown runtime', () => {
    it('still applies generic patterns', () => {
      expect(classifyContent('│ foo │ bar │ baz │', 'unknown-tool')).toBe('chrome')
      expect(classifyContent('Loading...', 'unknown-tool')).toBe('loading')
    })

    it('does not apply claude-code-specific patterns', () => {
      expect(classifyContent('? for shortcuts', 'unknown-tool')).toBe('content')
    })
  })

  describe('no runtime', () => {
    it('applies generic patterns when runtime is undefined', () => {
      expect(classifyContent('└──────┘')).toBe('chrome')
      expect(classifyContent('Searching...')).toBe('loading')
      expect(classifyContent('Hello world')).toBe('content')
    })
  })
})
