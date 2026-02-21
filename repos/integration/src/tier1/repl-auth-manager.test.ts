import { describe, test, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { env } from '../utils/env'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: REPL AuthManager — Live Proxy Validation
 *
 * Tests the REPL's AuthManager.login() against the live K8s proxy.
 * ConfigService is mocked to an in-memory store so no filesystem writes occur.
 */

// Mock ConfigService with an in-memory store before importing AuthManager
let store: Record<string, any> = {}

vi.mock('@TRL/services/config', () => ({
  ConfigService: {
    loadGlobal: () => ({ ...store }),
    saveGlobal: (config: Record<string, any>) => {
      store = { ...config }
    },
  },
}))

import { AuthManager } from '@tdsk/repl/services/auth'

describe('Tier 1: REPL AuthManager (live)', () => {
  const ctx = readContext()
  let auth: AuthManager

  beforeAll(() => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  })

  beforeEach(() => {
    store = {}
    auth = new AuthManager()
  })

  afterAll(() => {
    store = {}
  })

  // ─── Login with valid key ─────────────────────────────────────────

  test('login with valid API key succeeds against live proxy', async () => {
    await expect(
      auth.login(ctx.apiKey, env.proxyUrl, true)
    ).resolves.not.toThrow()
  })

  test('login stores credentials via ConfigService', async () => {
    await auth.login(ctx.apiKey, env.proxyUrl, true)

    expect(store.auth).toBeDefined()
    expect(store.auth.apiKey).toBe(ctx.apiKey)
  })

  test('loggedIn returns true after login', async () => {
    await auth.login(ctx.apiKey, env.proxyUrl, true)
    expect(auth.loggedIn()).toBe(true)
  })

  test('creds returns stored values after login', async () => {
    await auth.login(ctx.apiKey, env.proxyUrl, true)

    const creds = auth.creds()
    expect(creds).not.toBeNull()
    expect(creds!.apiKey).toBe(ctx.apiKey)
    expect(creds!.proxyUrl).toBe(env.proxyUrl)
  })

  // ─── Login failures ───────────────────────────────────────────────

  test('login with invalid API key throws "Authentication failed"', async () => {
    await expect(
      auth.login('tdsk_invalid_key_12345', env.proxyUrl, true)
    ).rejects.toThrow('Authentication failed')
  })

  test('login with bad prefix throws "Invalid API key format"', async () => {
    await expect(
      auth.login('bad-key-no-prefix', env.proxyUrl, true)
    ).rejects.toThrow('Invalid API key format')
  })

  // ─── Insecure flag ────────────────────────────────────────────────

  test('login with insecure=true stores insecure flag', async () => {
    await auth.login(ctx.apiKey, env.proxyUrl, true)
    expect(store.auth.insecure).toBe(true)
  })

  // ─── Logout ───────────────────────────────────────────────────────

  test('logout removes auth from store', async () => {
    await auth.login(ctx.apiKey, env.proxyUrl, true)
    expect(auth.loggedIn()).toBe(true)

    auth.logout()
    expect(store.auth).toBeUndefined()
  })

  test('loggedIn returns false after logout', async () => {
    await auth.login(ctx.apiKey, env.proxyUrl, true)
    auth.logout()
    expect(auth.loggedIn()).toBe(false)
  })
})
