import type { TEmailConfig } from '@TBE/types/email.types'

import { describe, it, expect, vi } from 'vitest'
import { EmailService } from '@TBE/services/email/email'
import { templates } from '@TBE/services/email/templates'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe(`EmailService`, () => {
  describe(`constructor`, () => {
    it(`should create service with resend strategy`, () => {
      const config: TEmailConfig = {
        type: `resend`,
        from: `noreply@test.com`,
        apiKey: `test-api-key`,
      }

      const service = new EmailService(config)
      expect(service).toBeInstanceOf(EmailService)
    })

    it(`should create service with mailgun strategy`, () => {
      const config: TEmailConfig = {
        type: `mailgun`,
        from: `noreply@test.com`,
        smtp: {
          host: `smtp.mailgun.org`,
          port: 587,
          user: `postmaster@example.com`,
          pass: `secret`,
        },
      }

      const service = new EmailService(config)
      expect(service).toBeInstanceOf(EmailService)
    })

    it(`should create service with console strategy`, () => {
      const config: TEmailConfig = {
        type: `console`,
        from: `noreply@test.com`,
      }

      const service = new EmailService(config)
      expect(service).toBeInstanceOf(EmailService)
    })

    it(`should throw error when resend config is missing API key`, () => {
      const config: TEmailConfig = {
        type: `resend`,
        from: `noreply@test.com`,
      }

      expect(() => new EmailService(config)).toThrow(`Resend API key is required`)
    })

    it(`should throw error when mailgun config is missing SMTP`, () => {
      const config: TEmailConfig = {
        type: `mailgun`,
        from: `noreply@test.com`,
      }

      expect(() => new EmailService(config)).toThrow(`SMTP configuration is required`)
    })

    it(`should fallback to console for unknown provider`, () => {
      const config: TEmailConfig = {
        type: `unknown` as any,
        from: `noreply@test.com`,
      }

      const service = new EmailService(config)
      expect(service).toBeInstanceOf(EmailService)
    })
  })

  describe(`send`, () => {
    it(`should send email via strategy`, async () => {
      const config: TEmailConfig = {
        type: `console`,
        from: `noreply@test.com`,
      }

      const service = new EmailService(config)

      const result = await service.send({
        to: `user@example.com`,
        subject: `Test`,
        html: `<p>Test</p>`,
      })

      expect(result.success).toBe(true)
    })
  })

  describe(`invitation`, () => {
    it(`should send invitation email using template`, async () => {
      const config: TEmailConfig = {
        type: `console`,
        from: `noreply@test.com`,
      }

      const service = new EmailService(config)

      // Mock template service to avoid file system dependencies in tests
      const mockRender = vi.spyOn(templates, `render`)
      mockRender.mockResolvedValueOnce(`<p>Invitation HTML</p>`)

      const result = await service.invitation({
        email: `user@example.com`,
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Admin`,
        invitationUrl: `https://example.com/invite/123`,
        expiresInDays: 7,
      })

      expect(result).toBe(true)
      expect(mockRender).toHaveBeenCalledWith(`invitation`, {
        email: `user@example.com`,
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Admin`,
        invitationUrl: `https://example.com/invite/123`,
        expiresInDays: 7,
      })

      mockRender.mockRestore()
    })

    it(`should handle template rendering errors`, async () => {
      const config: TEmailConfig = {
        type: `console`,
        from: `noreply@test.com`,
      }

      const service = new EmailService(config)

      // Mock template service to throw error
      const mockRender = vi.spyOn(templates, `render`)
      mockRender.mockRejectedValueOnce(new Error(`Template not found`))

      const result = await service.invitation({
        email: `user@example.com`,
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Admin`,
        invitationUrl: `https://example.com/invite/123`,
        expiresInDays: 7,
      })

      expect(result).toBe(false)

      mockRender.mockRestore()
    })
  })

  describe(`sendMemberNotification`, () => {
    it(`should send member notification using template`, async () => {
      const config: TEmailConfig = {
        type: `console`,
        from: `noreply@test.com`,
      }

      const service = new EmailService(config)

      // Mock template service to avoid file system dependencies in tests
      const mockRender = vi.spyOn(templates, `render`)
      mockRender.mockResolvedValueOnce(`<p>Notification HTML</p>`)

      const result = await service.sendMemberNotification({
        email: `user@example.com`,
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Member`,
        orgUrl: `https://example.com/org/123`,
      })

      expect(result).toBe(true)
      expect(mockRender).toHaveBeenCalledWith(`member-notification`, {
        email: `user@example.com`,
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Member`,
        orgUrl: `https://example.com/org/123`,
      })

      mockRender.mockRestore()
    })
  })
})
