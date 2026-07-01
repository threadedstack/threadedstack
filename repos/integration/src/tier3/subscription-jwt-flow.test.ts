import { describe, test, expect, beforeAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { acquireJwt } from '../utils/jwt-auth'

/**
 * Tier 3: Subscription mutation flow under REAL JWT auth.
 *
 * Subscription mutation endpoints reject API-key auth with 403 before any
 * logic runs, so the API-key-based suites can only assert that rejection.
 * This suite acquires a real Neon Auth JWT (via `acquireJwt`) and proves the
 * mutation endpoints ACCEPT JWT auth and reach their validation logic — the
 * one thing the API-key tier structurally cannot show.
 *
 * Skips when JWT creds (TDSK_IT_AUTH_URL / TDSK_IT_USER_EMAIL /
 * TDSK_IT_USER_PASSWORD) are not configured, mirroring
 * `tier1/sandbox-org-seeding.test.ts`.
 *
 * IMPORTANT: assertions are limited to validation-error paths (invalid/missing
 * tier, free-tier checkout rejection) and a read. We deliberately do NOT send a
 * valid paid-tier update/checkout, which would perform a real Stripe mutation
 * on the seeded test user's subscription.
 */
describe('Tier 3: Subscription JWT Flow', () => {
  let jwt = ''
  let setupSkipped = false

  const jwtOpts = () => ({ apiKey: jwt })

  beforeAll(async () => {
    const token = await acquireJwt()
    if (!token) {
      console.warn('[subscription-jwt-flow] Could not acquire JWT — skipping suite')
      setupSkipped = true
      return
    }
    jwt = token
  }, 30_000)

  test('GET /subscriptions/current returns 200 under JWT (sanity)', async () => {
    if (setupSkipped) return
    const res = await get<{ tier: string }>('/subscriptions/current', jwtOpts())
    expect(res.status).toBe(200)
    expect(typeof res.data?.tier).toBe('string')
  })

  test('POST /subscriptions/update: JWT reaches logic, invalid tier → 400 (not 403)', async () => {
    if (setupSkipped) return
    const res = await post('/subscriptions/update', { tier: 'not-a-tier' }, jwtOpts())
    // The key assertion: JWT is NOT rejected by the api-key guard.
    expect(res.status).not.toBe(403)
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.error ?? '')).toMatch(/invalid tier/i)
  })

  test('POST /subscriptions/update: JWT + missing tier → 400 (not 403)', async () => {
    if (setupSkipped) return
    const res = await post('/subscriptions/update', {}, jwtOpts())
    expect(res.status).not.toBe(403)
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.error ?? '')).toMatch(/tier/i)
  })

  test('POST /subscriptions/checkout: JWT + free tier → 400 rejected (not 403)', async () => {
    if (setupSkipped) return
    const res = await post(
      '/subscriptions/checkout',
      {
        tier: 'free',
        successUrl: 'https://example.com/ok',
        cancelUrl: 'https://example.com/no',
      },
      jwtOpts()
    )
    expect(res.status).not.toBe(403)
    expect(res.status).toBe(400)
  })

  test('CONTRAST: same endpoint under API key → 403 (mutation guard)', async () => {
    if (setupSkipped) return
    // Default auth = TDSK_IT_API_KEY (no jwtOpts) → must be rejected.
    const res = await post('/subscriptions/update', { tier: 'not-a-tier' })
    expect(res.status).toBe(403)
  })
})
