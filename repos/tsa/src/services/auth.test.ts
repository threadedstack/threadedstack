import { AuthManager } from './auth'
import { ConfigService } from '@TSA/services/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TSA/services/config`, () => ({
  ConfigService: {
    loadGlobal: vi.fn(),
    saveGlobal: vi.fn(),
    updateKey: vi.fn(),
    deleteKey: vi.fn(),
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

    it(`should return credentials when apiKey exists in config`, () => {
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

    it(`should return credentials when only token is set`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: {
          token: `jwt.token.value`,
          expiresAt: `2099-12-31T00:00:00.000Z`,
          proxyUrl: `https://proxy.test`,
        },
      })

      const creds = auth.creds()
      expect(creds).toEqual({
        token: `jwt.token.value`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
        insecure: undefined,
      })
    })

    it(`should return null when neither apiKey nor token is set`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { proxyUrl: `https://proxy.test` },
      })
      expect(auth.creds()).toBeNull()
    })

    it(`should return null when apiKey is empty string`, () => {
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

  describe(`bearer`, () => {
    it(`should return apiKey when apiKey is present`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test123`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.bearer).toBe(`tdsk_test123`)
    })

    it(`should return token when only token is set`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { token: `jwt.token.here`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.bearer).toBe(`jwt.token.here`)
    })

    it(`should prefer apiKey over token`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: {
          apiKey: `tdsk_test123`,
          token: `jwt.token.here`,
          proxyUrl: `https://proxy.test`,
        },
      })
      expect(auth.bearer).toBe(`tdsk_test123`)
    })

    it(`should return null when not logged in`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})
      expect(auth.bearer).toBeNull()
    })
  })

  describe(`loggedIn`, () => {
    it(`should return false when no credentials`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})
      expect(auth.loggedIn()).toBe(false)
    })

    it(`should return true when apiKey credentials exist`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.loggedIn()).toBe(true)
    })

    it(`should return true when token credentials exist`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { token: `jwt.token.here`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.loggedIn()).toBe(true)
    })
  })

  describe(`isExpired`, () => {
    it(`should return false when no expiresAt is set`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.isExpired()).toBe(false)
    })

    it(`should return false when using API key auth`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { apiKey: `tdsk_test`, proxyUrl: `https://proxy.test` },
      })
      expect(auth.isExpired()).toBe(false)
    })

    it(`should return false when expiresAt is in the future`, () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { token: `jwt.token`, expiresAt: future, proxyUrl: `https://proxy.test` },
      })
      expect(auth.isExpired()).toBe(false)
    })

    it(`should return true when expiresAt is in the past`, () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString()
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({
        auth: { token: `jwt.token`, expiresAt: past, proxyUrl: `https://proxy.test` },
      })
      expect(auth.isExpired()).toBe(true)
    })

    it(`should return false when not logged in`, () => {
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})
      expect(auth.isExpired()).toBe(false)
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

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(mockFetch).toHaveBeenCalledWith(`https://proxy.test/_/orgs`, {
        headers: {
          Authorization: `Bearer tdsk_test123`,
          Accept: `application/json`,
        },
        signal: expect.any(AbortSignal),
      })
    })

    it(`should save credentials with apiKey and no token fields`, async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(ConfigService.updateKey).toHaveBeenCalledWith(`auth`, {
        apiKey: `tdsk_test123`,
        proxyUrl: `https://proxy.test`,
        insecure: undefined,
      })
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

      await auth.login(`tdsk_test123`)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`px.local.threadedstack.app`),
        expect.any(Object)
      )
    })

    it(`should store insecure flag when provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await auth.login(`tdsk_test123`, `https://proxy.test`, true)

      expect(ConfigService.updateKey).toHaveBeenCalledWith(
        `auth`,
        expect.objectContaining({ insecure: true })
      )
    })

    it(`should set NODE_TLS_REJECT_UNAUTHORIZED during request when insecure`, async () => {
      let tlsValueDuringFetch: string | undefined
      mockFetch.mockImplementation(async () => {
        tlsValueDuringFetch = process.env.NODE_TLS_REJECT_UNAUTHORIZED
        return { ok: true }
      })

      await auth.login(`tdsk_test123`, `https://proxy.test`, true)

      expect(tlsValueDuringFetch).toBe(`0`)
    })

    it(`should not store insecure flag when not provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(ConfigService.updateKey).toHaveBeenCalledWith(
        `auth`,
        expect.objectContaining({ insecure: undefined })
      )
    })

    it(`should reject with a clear timeout error when the request never resolves`, async () => {
      vi.useFakeTimers()

      // Replace AbortSignal.timeout with a fake-timer-driven equivalent so
      // advancing vitest's fake clock actually fires the abort - the real
      // implementation relies on platform timers that fake timers can't reach.
      vi.spyOn(AbortSignal, `timeout`).mockImplementation((ms: number) => {
        const controller = new AbortController()
        setTimeout(() => {
          controller.abort(new DOMException(`signal timed out`, `TimeoutError`))
        }, ms)
        return controller.signal
      })

      mockFetch.mockImplementationOnce(
        (_url: string, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener(`abort`, () => {
              reject(new DOMException(`signal timed out`, `TimeoutError`))
            })
          })
      )

      const assertion = expect(
        auth.login(`tdsk_test123`, `https://proxy.test`)
      ).rejects.toThrow(`Connection to https://proxy.test timed out after 10s`)

      await vi.advanceTimersByTimeAsync(10_000)
      await assertion

      vi.useRealTimers()
    })
  })

  describe(`loginWithToken`, () => {
    it(`should validate token against proxy`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.loginWithToken({
        token: `jwt.token.value`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
      })

      expect(mockFetch).toHaveBeenCalledWith(`https://proxy.test/_/orgs`, {
        headers: {
          Authorization: `Bearer jwt.token.value`,
          Accept: `application/json`,
        },
        signal: expect.any(AbortSignal),
      })
    })

    it(`should save token and expiresAt without apiKey field`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.loginWithToken({
        token: `jwt.token.value`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
      })

      const savedConfig = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
      expect(savedConfig.auth).toEqual({
        token: `jwt.token.value`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
        insecure: undefined,
        neonAuthUrl: undefined,
      })
      expect(savedConfig.auth?.apiKey).toBeUndefined()
    })

    it(`should throw on auth failure`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => `Forbidden`,
      })

      await expect(
        auth.loginWithToken({
          token: `bad.token`,
          expiresAt: `2099-12-31T00:00:00.000Z`,
          proxyUrl: `https://proxy.test`,
        })
      ).rejects.toThrow(`Authentication failed (403)`)
    })

    it(`should store neonAuthUrl when provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.loginWithToken({
        token: `jwt.token.value`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
        insecure: false,
        neonAuthUrl: `https://auth.example.com`,
      })

      const savedConfig = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
      expect(savedConfig.auth?.neonAuthUrl).toBe(`https://auth.example.com`)
    })

    it(`should use default proxy URL when none provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.loginWithToken({
        token: `jwt.token.value`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`px.local.threadedstack.app`),
        expect.any(Object)
      )
    })

    it(`should set NODE_TLS_REJECT_UNAUTHORIZED during request when insecure`, async () => {
      let tlsValueDuringFetch: string | undefined
      mockFetch.mockImplementation(async () => {
        tlsValueDuringFetch = process.env.NODE_TLS_REJECT_UNAUTHORIZED
        return { ok: true }
      })
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      await auth.loginWithToken({
        token: `jwt.token`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        proxyUrl: `https://proxy.test`,
        insecure: true,
      })

      expect(tlsValueDuringFetch).toBe(`0`)
    })

    it(`should reject with a clear timeout error when the request never resolves`, async () => {
      vi.useFakeTimers()
      vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

      vi.spyOn(AbortSignal, `timeout`).mockImplementation((ms: number) => {
        const controller = new AbortController()
        setTimeout(() => {
          controller.abort(new DOMException(`signal timed out`, `TimeoutError`))
        }, ms)
        return controller.signal
      })

      mockFetch.mockImplementationOnce(
        (_url: string, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener(`abort`, () => {
              reject(new DOMException(`signal timed out`, `TimeoutError`))
            })
          })
      )

      const assertion = expect(
        auth.loginWithToken({
          token: `jwt.token.value`,
          expiresAt: `2099-12-31T00:00:00.000Z`,
          proxyUrl: `https://proxy.test`,
        })
      ).rejects.toThrow(`Connection to https://proxy.test timed out after 10s`)

      await vi.advanceTimersByTimeAsync(10_000)
      await assertion

      vi.useRealTimers()
    })

    describe(`JWT expiry resolution`, () => {
      const makeJwt = (payload: Record<string, unknown>): string => {
        const header = Buffer.from(JSON.stringify({ alg: `none` })).toString(`base64url`)
        const body = Buffer.from(JSON.stringify(payload)).toString(`base64url`)
        return `${header}.${body}.sig`
      }

      it(`should use JWT exp when shorter than session expiry`, async () => {
        mockFetch.mockResolvedValue({ ok: true })
        vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

        const jwtExp = Math.floor(Date.now() / 1000) + 900
        const token = makeJwt({ sub: `user`, exp: jwtExp })
        const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

        await auth.loginWithToken({
          token,
          expiresAt: sessionExpiry,
          proxyUrl: `https://proxy.test`,
        })

        const saved = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
        expect(saved.auth?.expiresAt).toBe(new Date(jwtExp * 1000).toISOString())
      })

      it(`should use session expiry when JWT exp is longer`, async () => {
        mockFetch.mockResolvedValue({ ok: true })
        vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

        const jwtExp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
        const token = makeJwt({ sub: `user`, exp: jwtExp })
        const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

        await auth.loginWithToken({
          token,
          expiresAt: sessionExpiry,
          proxyUrl: `https://proxy.test`,
        })

        const saved = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
        expect(saved.auth?.expiresAt).toBe(sessionExpiry)
      })

      it(`should use JWT exp when no session expiry provided`, async () => {
        mockFetch.mockResolvedValue({ ok: true })
        vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

        const jwtExp = Math.floor(Date.now() / 1000) + 900
        const token = makeJwt({ sub: `user`, exp: jwtExp })

        await auth.loginWithToken({
          token,
          proxyUrl: `https://proxy.test`,
        })

        const saved = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
        expect(saved.auth?.expiresAt).toBe(new Date(jwtExp * 1000).toISOString())
      })

      it(`should fall back to session expiry when JWT has no exp claim`, async () => {
        mockFetch.mockResolvedValue({ ok: true })
        vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

        const token = makeJwt({ sub: `user` })
        const sessionExpiry = `2099-12-31T00:00:00.000Z`

        await auth.loginWithToken({
          token,
          expiresAt: sessionExpiry,
          proxyUrl: `https://proxy.test`,
        })

        const saved = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
        expect(saved.auth?.expiresAt).toBe(sessionExpiry)
      })

      it(`should fall back to session expiry for non-JWT tokens`, async () => {
        mockFetch.mockResolvedValue({ ok: true })
        vi.mocked(ConfigService.loadGlobal).mockReturnValue({})

        const sessionExpiry = `2099-12-31T00:00:00.000Z`

        await auth.loginWithToken({
          token: `opaque-token-string`,
          expiresAt: sessionExpiry,
          proxyUrl: `https://proxy.test`,
        })

        const saved = vi.mocked(ConfigService.saveGlobal).mock.calls[0][0]
        expect(saved.auth?.expiresAt).toBe(sessionExpiry)
      })
    })
  })

  describe(`logout`, () => {
    it(`should remove auth from config`, () => {
      auth.logout()

      expect(ConfigService.deleteKey).toHaveBeenCalledWith(`auth`)
    })

    it(`should not throw on error`, () => {
      vi.mocked(ConfigService.deleteKey).mockImplementation(() => {
        throw new Error(`read error`)
      })

      expect(() => auth.logout()).not.toThrow()
    })
  })
})
