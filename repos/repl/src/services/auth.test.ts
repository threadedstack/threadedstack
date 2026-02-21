import { AuthManager } from './auth'
import { ConfigService } from '@TRL/services/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TRL/services/config`, () => ({
  ConfigService: {
    loadGlobal: vi.fn(),
    saveGlobal: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

describe(`AuthManager`, () => {
  let auth: AuthManager

  beforeEach(() => {
    auth = new AuthManager()
    vi.clearAllMocks()
  })

  describe(`creds`, () => {
    it(`should return null when no auth in config`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})
      expect(auth.creds()).toBeNull()
    })

    it(`should return credentials when auth exists in config`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test123`, proxyUrl: `https://proxy.test` },
      })

      const creds = auth.creds()
      expect(creds).toEqual({
        apiKey: `tdsk_test123`,
        proxyUrl: `https://proxy.test`,
        insecure: undefined,
      })
    })

    it(`should return null when apiKey is missing`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `` },
      })
      expect(auth.creds()).toBeNull()
    })

    it(`should use default proxy URL when not in config`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test123` },
      })

      const creds = auth.creds()
      expect(creds?.proxyUrl).toContain(`px.local.threadedstack.app`)
    })

    it(`should return null on error`, () => {
      vi.mocked(ConfigService.loadGlobal).mockImplementation(() => {
        throw new Error(`read error`)
      })
      expect(auth.creds()).toBeNull()
    })
  })

  describe(`loggedIn`, () => {
    it(`should return false when no credentials`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})
      expect(auth.loggedIn()).toBe(false)
    })

    it(`should return true when credentials exist`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.loggedIn()).toBe(true)
    })
  })

  describe(`login`, () => {
    it(`should reject keys without tdsk_ prefix`, async () => {
      await expect(auth.login(`invalid_key`)).rejects.toThrow(`Invalid API key format`)
    })

    it(`should validate key against proxy`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(mockFetch).toHaveBeenCalledWith(`https://proxy.test/_/orgs`, {
        headers: {
          Authorization: `Bearer tdsk_test123`,
          Accept: `application/json`,
        },
      })
    })

    it(`should save credentials via ConfigService`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(ConfigService.saveGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            apiKey: `tdsk_test123`,
            proxyUrl: `https://proxy.test`,
          }),
        })
      )
    })

    it(`should throw on auth failure`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => `Unauthorized`,
      })

      await expect(auth.login(`tdsk_test123`, `https://proxy.test`)).rejects.toThrow(
        `Authentication failed (401)`
      )
    })

    it(`should use default proxy URL when none provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.login(`tdsk_test123`)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`px.local.threadedstack.app`),
        expect.any(Object)
      )
    })

    it(`should store insecure flag when provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.login(`tdsk_test123`, `https://proxy.test`, true)

      expect(ConfigService.saveGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            insecure: true,
          }),
        })
      )
    })

    it(`should set NODE_TLS_REJECT_UNAUTHORIZED when insecure`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      const original = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      await auth.login(`tdsk_test123`, `https://proxy.test`, true)

      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(`0`)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = original
    })

    it(`should not store insecure flag when not provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      const savedConfig = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
      expect(savedConfig.auth?.insecure).toBeUndefined()
    })
  })

  describe(`logout`, () => {
    it(`should remove auth from config`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test`, proxyUrl: `https://proxy.test` },
        org: `org_1`,
      })

      auth.logout()

      expect(ConfigService.saveGlobal).toHaveBeenCalledWith(
        expect.not.objectContaining({ auth: expect.anything() })
      )
    })

    it(`should not throw on error`, () => {
      vi.mocked(ConfigService.loadGlobal).mockImplementation(() => {
        throw new Error(`read error`)
      })

      expect(() => auth.logout()).not.toThrow()
    })
  })
})
