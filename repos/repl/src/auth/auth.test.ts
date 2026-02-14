import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'

vi.mock(`node:fs`, () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

import { AuthManager } from './auth'

describe(`AuthManager`, () => {
  let auth: AuthManager

  beforeEach(() => {
    auth = new AuthManager()
    vi.clearAllMocks()
  })

  describe(`getCredentials`, () => {
    it(`should return null when config file does not exist`, () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(auth.getCredentials()).toBeNull()
    })

    it(`should return credentials when config file exists`, () => {
      const creds = { apiKey: `tdsk_test123`, proxyUrl: `https://proxy.test` }
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(creds))

      expect(auth.getCredentials()).toEqual(creds)
    })

    it(`should return null for invalid JSON`, () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(`not json`)

      expect(auth.getCredentials()).toBeNull()
    })

    it(`should return null when apiKey is missing`, () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ proxyUrl: `https://proxy.test` })
      )

      expect(auth.getCredentials()).toBeNull()
    })
  })

  describe(`isLoggedIn`, () => {
    it(`should return false when no credentials`, () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(auth.isLoggedIn()).toBe(false)
    })

    it(`should return true when credentials exist`, () => {
      const creds = { apiKey: `tdsk_test`, proxyUrl: `https://proxy.test` }
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(creds))

      expect(auth.isLoggedIn()).toBe(true)
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
      vi.mocked(existsSync).mockReturnValue(true)

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(mockFetch).toHaveBeenCalledWith(`https://proxy.test/_/orgs`, {
        headers: {
          Authorization: `Bearer tdsk_test123`,
          Accept: `application/json`,
        },
      })
    })

    it(`should save credentials on success`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(true)

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(`repl-auth.json`),
        expect.stringContaining(`tdsk_test123`),
        `utf-8`
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
      vi.mocked(existsSync).mockReturnValue(true)

      await auth.login(`tdsk_test123`)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`px.local.threadedstack.app`),
        expect.any(Object)
      )
    })

    it(`should create config directory if missing`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(false)

      await auth.login(`tdsk_test123`)

      expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining(`tdsk`), {
        recursive: true,
      })
    })

    it(`should store insecure flag when provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(true)

      await auth.login(`tdsk_test123`, `https://proxy.test`, true)

      const savedData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
      expect(savedData.insecure).toBe(true)
    })

    it(`should set NODE_TLS_REJECT_UNAUTHORIZED when insecure`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(true)

      const original = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      await auth.login(`tdsk_test123`, `https://proxy.test`, true)

      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(`0`)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = original
    })

    it(`should not store insecure flag when not provided`, async () => {
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(true)

      await auth.login(`tdsk_test123`, `https://proxy.test`)

      const savedData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
      expect(savedData.insecure).toBeUndefined()
    })
  })

  describe(`logout`, () => {
    it(`should delete credentials file`, () => {
      vi.mocked(existsSync).mockReturnValue(true)

      auth.logout()

      expect(unlinkSync).toHaveBeenCalledWith(expect.stringContaining(`repl-auth.json`))
    })

    it(`should not throw when file does not exist`, () => {
      vi.mocked(existsSync).mockReturnValue(false)

      expect(() => auth.logout()).not.toThrow()
    })
  })
})
