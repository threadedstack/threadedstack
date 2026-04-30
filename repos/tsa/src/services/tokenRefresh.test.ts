import { AuthManager } from '@TSA/services/auth'
import { TokenRefreshService } from './tokenRefresh'
import { ConfigService } from '@TSA/services/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TSA/services/config`, () => ({
  ConfigService: {
    loadGlobal: vi.fn(),
    saveGlobal: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

/**
 * Creates a real AuthManager instance whose behavior is controlled
 * via ConfigService.loadGlobal mock returns. TokenRefreshService uses
 * private fields (#auth), so plain object mocks won't work.
 */
const buildAuthWithConfig = (authConfig: Record<string, unknown> = {}) => {
  vi.mocked(ConfigService.loadGlobal).mockReturnValue({ auth: authConfig })
  const auth = new AuthManager()
  // Spy on loginWithToken so we can assert it was called
  vi.spyOn(auth, `loginWithToken`).mockResolvedValue(undefined)
  return auth
}

describe(`TokenRefreshService`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TDSK_AUTH_URL
  })

  describe(`maybeRefresh`, () => {
    it(`should return true (no-op) for API key auth`, async () => {
      const auth = buildAuthWithConfig({
        apiKey: `tdsk_test123`,
        proxyUrl: `https://proxy.test`,
      })
      const service = new TokenRefreshService(auth)

      const result = await service.maybeRefresh()
      expect(result).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it(`should return true (no-op) when no expiresAt`, async () => {
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        proxyUrl: `https://proxy.test`,
      })
      const service = new TokenRefreshService(auth)

      const result = await service.maybeRefresh()
      expect(result).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it(`should return true (no-op) when token is not near expiry`, async () => {
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: tenMinutesFromNow,
        proxyUrl: `https://proxy.test`,
      })
      const service = new TokenRefreshService(auth)

      const result = await service.maybeRefresh()
      expect(result).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it(`should return true when not logged in`, async () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})
      const auth = new AuthManager()
      const service = new TokenRefreshService(auth)

      const result = await service.maybeRefresh()
      expect(result).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it(`should attempt refresh when within 2 min of expiry`, async () => {
      const ninetySecondsFromNow = new Date(Date.now() + 90 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: ninetySecondsFromNow,
        proxyUrl: `https://proxy.test`,
        authUrl: `https://auth.example.com`,
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {
            token: `jwt.refreshed.token`,
            expiresAt: `2099-12-31T00:00:00.000Z`,
          },
        }),
      })

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://auth.example.com/api/auth/get-session`,
        {
          headers: {
            Accept: `application/json`,
            Authorization: `Bearer jwt.token.here`,
          },
        }
      )
      expect(auth.loginWithToken).toHaveBeenCalledWith({
        token: `jwt.refreshed.token`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
        insecure: undefined,
        authUrl: `https://auth.example.com`,
      })
    })

    it(`should return false when refresh endpoint fails`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
        authUrl: `https://auth.example.com`,
      })

      mockFetch.mockResolvedValue({ ok: false, status: 401 })

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(false)
    })

    it(`should return false when no auth URL is configured`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
      })

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it(`should fall back to TDSK_AUTH_URL env var when config has no authUrl`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
      })

      process.env.TDSK_AUTH_URL = `https://env-auth.example.com`

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: { token: `jwt.new`, expiresAt: `2099-01-01T00:00:00.000Z` },
        }),
      })

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://env-auth.example.com/api/auth/get-session`,
        expect.any(Object)
      )
    })

    it(`should deduplicate concurrent refresh calls`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
        authUrl: `https://auth.example.com`,
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: { token: `jwt.new`, expiresAt: `2099-01-01T00:00:00.000Z` },
        }),
      })

      const service = new TokenRefreshService(auth)

      // Fire three concurrent refreshes
      const [r1, r2, r3] = await Promise.all([
        service.maybeRefresh(),
        service.maybeRefresh(),
        service.maybeRefresh(),
      ])

      expect(r1).toBe(true)
      expect(r2).toBe(true)
      expect(r3).toBe(true)

      // fetch should only be called once despite three concurrent calls
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it(`should return false when fetch throws a network error`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
        authUrl: `https://auth.example.com`,
      })

      mockFetch.mockRejectedValue(new Error(`ECONNREFUSED`))

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(false)
    })

    it(`should return false when session response has no token`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
        authUrl: `https://auth.example.com`,
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ session: {} }),
      })

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(false)
    })

    it(`should handle expiresAt as Date instance in session response`, async () => {
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000).toISOString()
      const auth = buildAuthWithConfig({
        token: `jwt.token.here`,
        expiresAt: thirtySecondsFromNow,
        proxyUrl: `https://proxy.test`,
        authUrl: `https://auth.example.com`,
      })

      const expiresDate = new Date(`2099-12-31T00:00:00.000Z`)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {
            token: `jwt.refreshed.token`,
            expiresAt: expiresDate,
          },
        }),
      })

      const service = new TokenRefreshService(auth)
      const result = await service.maybeRefresh()

      expect(result).toBe(true)
      expect(auth.loginWithToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: `jwt.refreshed.token`,
          expiresAt: expiresDate.toISOString(),
        })
      )
    })
  })
})
