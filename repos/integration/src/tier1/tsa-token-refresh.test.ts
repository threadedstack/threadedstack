import { describe, test, expect, beforeAll } from 'vitest'
import { readContext } from '../utils/test-context'
import { createTestAuth } from '../utils/tsa-auth'
import { ApiClient } from '@tdsk/tsa'

/**
 * Tier 1: TSA Token Refresh — Auth Behavior Validation
 *
 * Validates the TSA ApiClient's authentication behavior:
 * - Valid API key succeeds
 * - Invalid/empty/malformed keys return 401
 * - Response shape on auth failure
 *
 * NOTE: Actual token refresh (JWT expiry + Neon Auth re-auth) is not tested
 * here because it requires a browser login flow. These tests cover the API key
 * authentication path used by CLI users.
 */
describe('Tier 1: TSA Token Refresh / Auth Behavior (live)', () => {
  const ctx = readContext()

  // ─── Valid auth ───────────────────────────────────────────────────

  describe('valid auth', () => {
    test('API request succeeds with valid API key', async () => {
      const auth = createTestAuth()
      const client = new ApiClient(auth as any)

      const { ok, status, data } = await client.listOrgs()
      expect(ok).toBe(true)
      expect(status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data!.length).toBeGreaterThan(0)
    })
  })

  // ─── Invalid auth ─────────────────────────────────────────────────

  describe('invalid auth', () => {
    test('API request fails with invalid API key (401)', async () => {
      const auth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const client = new ApiClient(auth as any)

      const { ok, status } = await client.listOrgs()
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })

    test('API request fails with empty auth — client rejects before sending', async () => {
      const auth = createTestAuth({ apiKey: '' })
      const client = new ApiClient(auth as any)

      await expect(client.listOrgs()).rejects.toThrow('Not logged in')
    })

    test('API request fails with malformed Bearer token (401)', async () => {
      const auth = createTestAuth({ apiKey: 'not-a-valid-bearer-format' })
      const client = new ApiClient(auth as any)

      const { ok, status } = await client.listOrgs()
      expect(ok).toBe(false)
      expect(status).toBe(401)
    })

    test('response shape on auth failure includes ok=false and error', async () => {
      const auth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const client = new ApiClient(auth as any)

      const result = await client.listOrgs()
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      // The response should have an error field (Exception or error details)
      expect(result.error).toBeTruthy()
    })

    test('multiple endpoints consistently return 401 with bad auth', async () => {
      const auth = createTestAuth({ apiKey: 'tdsk_invalid_key_12345' })
      const client = new ApiClient(auth as any)

      const [orgsResult, agentsResult, sandboxesResult] = await Promise.all([
        client.listOrgs(),
        client.listAgents(ctx.orgId),
        client.listSandboxes(ctx.orgId),
      ])

      expect(orgsResult.ok).toBe(false)
      expect(orgsResult.status).toBe(401)

      expect(agentsResult.ok).toBe(false)
      expect(agentsResult.status).toBe(401)

      expect(sandboxesResult.ok).toBe(false)
      expect(sandboxesResult.status).toBe(401)
    })
  })
})
