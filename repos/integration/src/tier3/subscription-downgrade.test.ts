import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

/**
 * Tier 3: Subscription Downgrade
 *
 * Subscription endpoints intentionally reject API key authentication —
 * see `repos/backend/src/endpoints/subscriptions/updateSubscription.ts`:
 *
 *   if (fromAuthHeaders(req).apiKeyId)
 *     throw new Exception(403, `Subscription endpoints do not accept API key authentication`)
 *
 * Integration tests authenticate via TDSK_IT_API_KEY (`tdsk_*` Bearer token),
 * so every call to /subscriptions/update from this suite is expected to be
 * blocked at the API-key guard BEFORE any body validation or Stripe lookup.
 *
 * This file documents that contract.
 *
 * The downgrade LOGIC (tier validation, downgrade-to-free cancel-at-period-end)
 * is covered by backend unit tests that mock auth + stub Stripe — see the
 * `POST /_/subscriptions/update` block in
 * `repos/backend/src/endpoints/subscriptions/subscriptions.test.ts`.
 * Only the real end-to-end Stripe network lifecycle (JWT + live Stripe) is
 * uncovered, and that needs a Playwright/e2e tier that does not exist yet.
 */
describe('Tier 3: Subscription Downgrade', () => {
  test('POST /subscriptions/update — rejects API key auth with 403 (missing tier)', async () => {
    const res = await post<{ error?: string }>('/subscriptions/update', {})

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/update — rejects API key auth with 403 (invalid tier)', async () => {
    const res = await post<{ error?: string }>('/subscriptions/update', {
      tier: 'nonexistent-tier',
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/update — rejects API key auth with 403 (valid tier value)', async () => {
    const res = await post<Record<string, unknown>>(
      '/subscriptions/update',
      { tier: 'solo' }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/update — rejects API key auth with 403 (downgrade to free)', async () => {
    const res = await post<Record<string, unknown>>(
      '/subscriptions/update',
      { tier: 'free' }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  test('POST /subscriptions/update — requires authentication', async () => {
    const res = await post(
      '/subscriptions/update',
      { tier: 'pro' },
      { noAuth: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})
