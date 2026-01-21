import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConsoleStrategy } from './console'
import type { TSendEmailOptions } from '@TBE/types/email.types'

// Mock the logger
vi.mock('@TBE/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('ConsoleStrategy', () => {
  let strategy: ConsoleStrategy

  beforeEach(() => {
    strategy = new ConsoleStrategy('noreply@test.com')
  })

  describe('send', () => {
    it('should log email and return success', async () => {
      const options: TSendEmailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)
      expect(result.messageId).toMatch(/^console-\d+$/)
    })

    it('should handle multiple recipients', async () => {
      const options: TSendEmailOptions = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)
      expect(result.messageId).toMatch(/^console-\d+$/)
    })

    it('should use custom from address if provided', async () => {
      const options: TSendEmailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        from: 'custom@example.com',
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)
    })
  })
})
