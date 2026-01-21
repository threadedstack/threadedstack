import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MailgunStrategy } from './mailgun'
import type { TSendEmailOptions } from '@TBE/types/email.types'

// Mock the logger
vi.mock('@TBE/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock nodemailer
vi.mock('nodemailer', async (importOriginal) => {
  const mockSendMail = vi.fn()
  const mockCreateTransport = vi.fn(() => ({
    sendMail: mockSendMail,
  }))

  return {
    createTransport: mockCreateTransport,
  }
})

describe('MailgunStrategy', () => {
  let strategy: MailgunStrategy
  let mockSendMail: any
  let mockCreateTransport: any

  beforeEach(async () => {
    const nodemailer = await import('nodemailer')
    mockSendMail = vi.fn()
    mockCreateTransport = nodemailer.createTransport as any
    mockCreateTransport.mockClear?.()

    strategy = new MailgunStrategy(
      {
        host: 'smtp.mailgun.org',
        port: 587,
        user: 'postmaster@example.com',
        pass: 'secret',
      },
      'noreply@test.com'
    )

    // Access the transporter's sendMail method
    const transporter = (strategy as any).transporter
    transporter.sendMail = mockSendMail
  })

  describe('send', () => {
    it('should send email successfully via Mailgun SMTP', async () => {
      mockSendMail.mockResolvedValueOnce({
        messageId: '<123@mailgun.org>',
      })

      const options: TSendEmailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('<123@mailgun.org>')
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@test.com',
          to: 'user@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
          text: 'Test content',
        })
      )
    })

    it('should handle multiple recipients', async () => {
      mockSendMail.mockResolvedValueOnce({
        messageId: '<456@mailgun.org>',
      })

      const options: TSendEmailOptions = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(true)
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user1@example.com, user2@example.com',
        })
      )
    })

    it('should use custom from address if provided', async () => {
      mockSendMail.mockResolvedValueOnce({
        messageId: '<789@mailgun.org>',
      })

      const options: TSendEmailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        from: 'custom@example.com',
      }

      await strategy.send(options)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com',
        })
      )
    })

    it('should handle SMTP errors', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'))

      const options: TSendEmailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      }

      const result = await strategy.send(options)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('SMTP connection failed')
    })
  })
})
