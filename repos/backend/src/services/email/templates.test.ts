import { TemplatesService } from '@TBE/services/email/templates'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

describe(`TemplatesService`, () => {
  let service: TemplatesService

  beforeEach(() => {
    service = new TemplatesService()
  })

  afterEach(() => {
    service.reset()
  })

  describe(`render`, () => {
    it(`should render a template with variables`, async () => {
      const html = await service.render(`invitation.html`, {
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Admin`,
        invitationUrl: `https://example.com/invite/123`,
        expiresInDays: 7,
      })

      expect(html).toContain(`Test Org`)
      expect(html).toContain(`John Doe`)
      expect(html).toContain(`Admin`)
      expect(html).toContain(`https://example.com/invite/123`)
      expect(html).toContain(`7`)
    })

    it(`should cache compiled templates`, async () => {
      // First render
      await service.render(`invitation.html`, {
        orgName: `Test Org`,
        inviterName: `John Doe`,
        roleType: `Admin`,
        invitationUrl: `https://example.com/invite/123`,
        expiresInDays: 7,
      })

      const stats = service.stats()
      expect(stats.size).toBe(1)
      expect(stats.templates).toContain(`invitation.html`)

      // Second render should use cache
      const html = await service.render(`invitation.html`, {
        orgName: `Different Org`,
        inviterName: `Jane Doe`,
        roleType: `Member`,
        invitationUrl: `https://example.com/invite/456`,
        expiresInDays: 14,
      })

      expect(html).toContain(`Different Org`)
      expect(html).toContain(`Jane Doe`)

      // Cache should still have only one entry
      const stats2 = service.stats()
      expect(stats2.size).toBe(1)
    })

    it(`should throw error for non-existent template`, async () => {
      await expect(service.render(`non-existent-template`, {})).rejects.toThrow(
        /Could not render template/
      )
    })
  })

  describe(`reset`, () => {
    it(`should clear all cached templates`, async () => {
      // Render a template to populate cache
      await service.render(`invitation.html`, {
        orgName: `Test`,
        inviterName: `Test`,
        roleType: `Test`,
        invitationUrl: `Test`,
        expiresInDays: 7,
      })

      expect(service.stats().size).toBe(1)

      service.reset()

      expect(service.stats().size).toBe(0)
    })
  })

  describe(`remove`, () => {
    it(`should clear specific template from cache`, async () => {
      // Render two templates
      await service.render(`invitation.html`, {
        orgName: `Test`,
        inviterName: `Test`,
        roleType: `Test`,
        invitationUrl: `Test`,
        expiresInDays: 7,
      })

      await service.render(`member-notification.html`, {
        email: `test@example.com`,
        orgName: `Test`,
        inviterName: `Test`,
        roleType: `Test`,
        orgUrl: `Test`,
      })

      expect(service.stats().size).toBe(2)

      service.remove(`invitation.html`)

      const stats = service.stats()
      expect(stats.size).toBe(1)
      expect(stats.templates).not.toContain(`invitation.html`)
      expect(stats.templates).toContain(`member-notification.html`)
    })
  })

  describe(`stats`, () => {
    it(`should return cache statistics`, async () => {
      const initialStats = service.stats()
      expect(initialStats.size).toBe(0)
      expect(initialStats.templates).toEqual([])

      await service.render(`invitation.html`, {
        orgName: `Test`,
        inviterName: `Test`,
        roleType: `Test`,
        invitationUrl: `Test`,
        expiresInDays: 7,
      })

      const stats = service.stats()
      expect(stats.size).toBe(1)
      expect(stats.templates).toContain(`invitation.html`)
    })
  })
})
