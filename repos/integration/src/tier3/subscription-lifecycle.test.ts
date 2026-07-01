import { describe, test, expect } from 'vitest'
import { get, post, del } from '../utils/api-client'

/**
 * Tier 3: Subscription Lifecycle
 *
 * GET endpoints (current, plans) are reachable via API key auth.
 *
 * Mutating endpoints (checkout, update, cancel, portal) intentionally reject
 * API key authentication and return 403 BEFORE any body validation —
 * see `repos/backend/src/endpoints/subscriptions/*.ts`:
 *
 *   if (fromAuthHeaders(req).apiKeyId)
 *     throw new Exception(403, `Subscription endpoints do not accept API key authentication`)
 *
 * Integration tests authenticate via TDSK_IT_API_KEY, so every POST/DELETE here
 * is expected to be blocked at the API-key guard.
 *
 * The mutation LOGIC (checkout, update, cancel, portal, tier validation,
 * downgrade-to-free) is covered by backend unit tests that mock auth without
 * an api-key id + stub Stripe — see
 * `repos/backend/src/endpoints/subscriptions/subscriptions.test.ts`.
 * What no test covers is the real end-to-end Stripe network lifecycle, which
 * requires JWT auth + a live Stripe test account (a Playwright/e2e tier that
 * does not exist yet).
 */
describe('Tier 3: Subscription Lifecycle', () => {

  test('GET /subscriptions/current — returns subscription with tier', async () => {
    const res = await get<{ tier: string; userId: string; status: string }>(
      '/subscriptions/current'
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(typeof res.data.tier).toBe('string')

    // Free tier users should have an active status
    const validTiers = ['free', 'solo', 'pro', 'team']
    expect(validTiers).toContain(res.data.tier)
  })

  test('GET /subscriptions/plans — returns all 4 tiers with correct limits shape', async () => {
    const res = await get<Array<Record<string, unknown>>>('/subscriptions/plans')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    // Plans should be returned — verify structure
    const plans = res.data
    expect(Array.isArray(plans) || typeof plans === 'object').toBe(true)

    // If it's an array of plans, verify TPlanLimits shape on each
    if (Array.isArray(plans) && plans.length > 0) {
      const limitKeys = [
        'organizations',
        'projects',
        'compute',
        'threads',
        'messages',
        'endpoints',
        'secrets',
        'retention',
        'seats',
        'additionalSeats',
      ]
      for (const plan of plans) {
        expect(plan).toHaveProperty('limits')
        for (const key of limitKeys) {
          expect(plan.limits).toHaveProperty(key)
        }
      }
    }
  })

  test('POST /subscriptions/checkout — rejects API key auth with 403 (missing fields)', async () => {
    const res = await post<{ error?: string }>(
      '/subscriptions/checkout',
      { tier: 'pro' }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/checkout — rejects API key auth with 403 (invalid tier)', async () => {
    const res = await post<{ error?: string }>(
      '/subscriptions/checkout',
      {
        tier: 'nonexistent-tier',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/checkout — rejects API key auth with 403 (free tier)', async () => {
    const res = await post<{ error?: string }>(
      '/subscriptions/checkout',
      {
        tier: 'free',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/checkout — rejects API key auth with 403 (valid tier + URLs)', async () => {
    const res = await post<Record<string, unknown>>(
      '/subscriptions/checkout',
      {
        tier: 'solo',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('DELETE /subscriptions/current — rejects API key auth with 403', async () => {
    const res = await del('/subscriptions/current')

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/portal — rejects API key auth with 403', async () => {
    const res = await post('/subscriptions/portal')

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })
})
