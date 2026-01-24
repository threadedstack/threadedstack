import { describe, it, expect } from 'vitest'
import { Context } from '@TAG/wasm/context'
import type { TMessage } from '@TAG/types'

describe('wasm/context', () => {
  describe('Constructor', () => {
    it('should initialize with default max tokens', () => {
      const ctx = new Context()
      expect(ctx.max).toBe(100000)
    })

    it('should initialize with custom max tokens', () => {
      const ctx = new Context({ max: 50000 })
      expect(ctx.max).toBe(50000)
    })

    it('should initialize with zero max tokens', () => {
      const ctx = new Context({ max: 0 })
      expect(ctx.max).toBe(0)
    })
  })

  describe('compose()', () => {
    it('should include system prompt and all messages when within budget', () => {
      const ctx = new Context({ max: 100000 })
      const system = 'You are a helpful assistant'
      const messages: TMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]

      const result = ctx.compose(system, messages)

      expect(result.system).toBe(system)
      expect(result.messages).toEqual(messages)
    })

    it('should truncate old messages when over budget (Middle-Out)', () => {
      const ctx = new Context({ max: 20 }) // Very small budget (20 tokens)

      const system = 'Sys' // ~1 token (3 chars / 4 = 0.75, rounds to 1)
      // Budget after system: 19 tokens
      const messages: TMessage[] = [
        { role: 'user', content: 'A'.repeat(100) }, // ~25 tokens (will be dropped)
        { role: 'assistant', content: 'B'.repeat(100) }, // ~25 tokens (will be dropped)
        { role: 'user', content: 'C'.repeat(40) }, // ~10 tokens (will fit)
        { role: 'assistant', content: 'D'.repeat(20) }, // ~5 tokens (will fit)
      ]

      const result = ctx.compose(system, messages)

      expect(result.system).toBe(system)
      // Should keep only the 2 most recent messages (15 tokens total < 19 budget)
      expect(result.messages.length).toBe(2)
      // Should keep the most recent message
      expect(result.messages[result.messages.length - 1].content).toBe('D'.repeat(20))
      // Should have dropped first 2 old messages
      expect(result.messages[0].content).toBe('C'.repeat(40))
    })

    it('should work backwards from most recent messages', () => {
      const ctx = new Context({ max: 100 })

      const system = 'System'
      const messages: TMessage[] = [
        { role: 'user', content: 'Message 1 - very old' },
        { role: 'assistant', content: 'Message 2 - old' },
        { role: 'user', content: 'Message 3 - recent' },
        { role: 'assistant', content: 'Message 4 - most recent' },
      ]

      const result = ctx.compose(system, messages)

      // All messages should fit, but verify order is preserved
      expect(result.messages[0].content).toBe('Message 1 - very old')
      expect(result.messages[result.messages.length - 1].content).toBe(
        'Message 4 - most recent'
      )
    })

    it('should handle empty message history', () => {
      const ctx = new Context({ max: 1000 })
      const system = 'System prompt'
      const messages: TMessage[] = []

      const result = ctx.compose(system, messages)

      expect(result.system).toBe(system)
      expect(result.messages).toEqual([])
    })

    it('should estimate tokens correctly (1 token ≈ 4 chars)', () => {
      const ctx = new Context({ max: 10 })

      const system = 'Sys' // ~1 token
      // Budget after system: 9 tokens
      const messages: TMessage[] = [
        { role: 'user', content: 'A'.repeat(40) }, // ~10 tokens (exceeds budget)
        { role: 'assistant', content: 'Short' }, // ~2 tokens
      ]

      const result = ctx.compose(system, messages)

      // Should only keep the shorter recent message
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].content).toBe('Short')
    })

    it('should keep as many recent messages as fit', () => {
      const ctx = new Context({ max: 50 })

      const system = 'S' // ~1 token
      const messages: TMessage[] = [
        { role: 'user', content: 'A'.repeat(100) }, // ~25 tokens
        { role: 'assistant', content: 'B'.repeat(40) }, // ~10 tokens
        { role: 'user', content: 'C'.repeat(40) }, // ~10 tokens
        { role: 'assistant', content: 'D'.repeat(40) }, // ~10 tokens
      ]

      const result = ctx.compose(system, messages)

      // Budget is 49 tokens after system
      // Should keep last 3 messages (30 tokens total)
      expect(result.messages).toHaveLength(3)
      expect(result.messages[0].content).toBe('B'.repeat(40))
      expect(result.messages[2].content).toBe('D'.repeat(40))
    })

    it('should return empty messages if system prompt exceeds budget', () => {
      const ctx = new Context({ max: 10 })

      const system = 'A'.repeat(100) // ~25 tokens (exceeds budget)
      const messages: TMessage[] = [{ role: 'user', content: 'Hello' }]

      const result = ctx.compose(system, messages)

      expect(result.system).toBe(system)
      expect(result.messages).toEqual([])
    })
  })

  describe('format()', () => {
    it('should format short content without truncation', () => {
      const ctx = new Context()
      const name = 'test.txt'
      const content = 'Short content\nWith a few lines'

      const result = ctx.format(name, content)

      expect(result).toBe(
        '--- CONTEXT: test.txt ---\nShort content\nWith a few lines\n--- END ---'
      )
    })

    it('should truncate content with more than 500 lines', () => {
      const ctx = new Context()
      const name = 'large.txt'
      const lines = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`)
      const content = lines.join('\n')

      const result = ctx.format(name, content)

      expect(result).toContain('--- CONTEXT: large.txt ---')
      expect(result).toContain('Line 1')
      expect(result).toContain('Line 100')
      expect(result).toContain('[truncated 400 lines]')
      expect(result).toContain('Line 501')
      expect(result).toContain('Line 600')
      expect(result).toContain('--- END ---')
    })

    it('should show first 100 and last 100 lines when truncating', () => {
      const ctx = new Context()
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`)
      const content = lines.join('\n')

      const result = ctx.format('file.txt', content)

      // Check first 100 lines are present
      expect(result).toContain('Line 1')
      expect(result).toContain('Line 100')

      // Check last 100 lines are present
      expect(result).toContain('Line 901')
      expect(result).toContain('Line 1000')

      // Check truncation message
      expect(result).toContain('[truncated 800 lines]')
    })

    it('should handle exactly 500 lines without truncation', () => {
      const ctx = new Context()
      const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`)
      const content = lines.join('\n')

      const result = ctx.format('file.txt', content)

      expect(result).not.toContain('truncated')
      expect(result).toContain('Line 1')
      expect(result).toContain('Line 500')
    })

    it('should handle exactly 501 lines with truncation', () => {
      const ctx = new Context()
      const lines = Array.from({ length: 501 }, (_, i) => `Line ${i + 1}`)
      const content = lines.join('\n')

      const result = ctx.format('file.txt', content)

      expect(result).toContain('[truncated 301 lines]')
    })

    it('should handle empty content', () => {
      const ctx = new Context()
      const result = ctx.format('empty.txt', '')

      expect(result).toBe('--- CONTEXT: empty.txt ---\n\n--- END ---')
    })

    it('should handle single line content', () => {
      const ctx = new Context()
      const result = ctx.format('single.txt', 'Single line')

      expect(result).toBe('--- CONTEXT: single.txt ---\nSingle line\n--- END ---')
    })
  })

  describe('estimateTokens()', () => {
    it('should estimate tokens using 4 chars per token', () => {
      const ctx = new Context()

      expect(ctx.estimateTokens('')).toBe(0)
      expect(ctx.estimateTokens('1234')).toBe(1)
      expect(ctx.estimateTokens('12345')).toBe(2)
      expect(ctx.estimateTokens('123456789')).toBe(3)
    })

    it('should round up partial tokens', () => {
      const ctx = new Context()

      expect(ctx.estimateTokens('A')).toBe(1) // 0.25 rounds up to 1
      expect(ctx.estimateTokens('AB')).toBe(1) // 0.5 rounds up to 1
      expect(ctx.estimateTokens('ABC')).toBe(1) // 0.75 rounds up to 1
      expect(ctx.estimateTokens('ABCD')).toBe(1) // 1.0
      expect(ctx.estimateTokens('ABCDE')).toBe(2) // 1.25 rounds up to 2
    })

    it('should handle large text', () => {
      const ctx = new Context()
      const text = 'A'.repeat(40000) // 40,000 characters

      expect(ctx.estimateTokens(text)).toBe(10000) // 40000 / 4 = 10000 tokens
    })
  })

  describe('fitsInBudget()', () => {
    it('should return true when text fits in budget', () => {
      const ctx = new Context()

      expect(ctx.fitsInBudget('1234', 1)).toBe(true)
      expect(ctx.fitsInBudget('12345678', 2)).toBe(true)
      expect(ctx.fitsInBudget('A'.repeat(400), 100)).toBe(true)
    })

    it('should return false when text exceeds budget', () => {
      const ctx = new Context()

      expect(ctx.fitsInBudget('12345', 1)).toBe(false)
      expect(ctx.fitsInBudget('A'.repeat(100), 10)).toBe(false)
      expect(ctx.fitsInBudget('A'.repeat(40000), 5000)).toBe(false)
    })

    it('should return true when text exactly matches budget', () => {
      const ctx = new Context()

      expect(ctx.fitsInBudget('1234', 1)).toBe(true)
      expect(ctx.fitsInBudget('A'.repeat(400), 100)).toBe(true)
    })

    it('should handle empty text', () => {
      const ctx = new Context()

      expect(ctx.fitsInBudget('', 0)).toBe(true)
      expect(ctx.fitsInBudget('', 100)).toBe(true)
    })

    it('should handle zero budget', () => {
      const ctx = new Context()

      expect(ctx.fitsInBudget('', 0)).toBe(true)
      expect(ctx.fitsInBudget('A', 0)).toBe(false)
    })
  })

  describe('Integration scenarios', () => {
    it('should work with realistic conversation', () => {
      const ctx = new Context({ max: 1000 })

      const system = 'You are a helpful coding assistant'
      const messages: TMessage[] = [
        { role: 'user', content: 'Can you help me write a function?' },
        { role: 'assistant', content: 'Of course! What kind of function?' },
        { role: 'user', content: 'A function that sorts an array' },
        {
          role: 'assistant',
          content:
            'Here is a sorting function:\n\nfunction sort(arr) {\n  return arr.sort();\n}',
        },
      ]

      const result = ctx.compose(system, messages)

      expect(result.system).toBe(system)
      expect(result.messages).toEqual(messages)
    })

    it('should handle conversation with tool calls', () => {
      const ctx = new Context({ max: 500 })

      const system = 'You are a file management assistant'
      const messages: TMessage[] = [
        { role: 'user', content: 'List files in current directory' },
        {
          role: 'assistant',
          content: 'I will list the files',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'listDirectory',
                arguments: '{"path":"."}',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: 'file1.txt\nfile2.txt\nfile3.txt',
          tool_call_id: 'call_1',
        },
        {
          role: 'assistant',
          content: 'Here are the files: file1.txt, file2.txt, file3.txt',
        },
      ]

      const result = ctx.compose(system, messages)

      expect(result.messages.length).toBeGreaterThan(0)
      // Should keep recent messages including tool results
      expect(result.messages[result.messages.length - 1].content).toContain('file1.txt')
    })
  })
})
