import type { TEmailConfig, TSendEmailOptions } from '@TBE/types'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResendStrategy } from '@TBE/services/email/strategies/resend'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

global.fetch = vi.fn()

describe(`ResendStrategy`, () => {
  let strategy: ResendStrategy

  beforeEach(() => {
    strategy = new ResendStrategy({
      apiKey: `test-api-key`,
      from: `noreply@test.com`,
      smtp: {
        host: `https://api.resend.com/emails`,
      },
    } as TEmailConfig)
    vi.clearAllMocks()
  })

  describe(`send`, () => {
    it(`should send email successfully via Resend API`, async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: `msg-123` }),
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

      const options: TSendEmailOptions = {
        to: `user@example.com`,
        subject: `Test Email`,
        text: `Test content`,
        html: `<p>Test content</p>`,
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)
      expect(result.messageId).toBe(`msg-123`)
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.resend.com/emails`,
        expect.objectContaining({
          method: `POST`,
          headers: expect.objectContaining({
            [`Content-Type`]: `application/json`,
            Authorization: `Bearer test-api-key`,
          }),
        })
      )
    })

    it(`should handle multiple recipients`, async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: `msg-456` }),
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

      const options: TSendEmailOptions = {
        to: [`user1@example.com`, `user2@example.com`],
        subject: `Test Email`,
        html: `<p>Test content</p>`,
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)

      const fetchCall = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.to).toEqual([`user1@example.com`, `user2@example.com`])
    })

    it(`should use custom from address if provided`, async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: `msg-789` }),
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

      const options: TSendEmailOptions = {
        to: `user@example.com`,
        subject: `Test Email`,
        html: `<p>Test content</p>`,
        from: `custom@example.com`,
      }

      await strategy.send(options)

      const fetchCall = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.from).toBe(`custom@example.com`)
    })

    it(`should handle API errors`, async () => {
      const mockResponse = {
        ok: false,
        statusText: `Bad Request`,
        json: async () => ({ message: `Invalid API key` }),
      }

      ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

      const options: TSendEmailOptions = {
        to: `user@example.com`,
        subject: `Test Email`,
        html: `<p>Test content</p>`,
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain(`Invalid API key`)
    })

    it(`should handle network errors`, async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error(`Network error`))

      const options: TSendEmailOptions = {
        to: `user@example.com`,
        subject: `Test Email`,
        html: `<p>Test content</p>`,
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe(`Network error`)
    })
  })
})
