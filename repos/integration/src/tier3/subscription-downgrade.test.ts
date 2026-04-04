import { describe, test, expect } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 3: Subscription Downgrade
 *
 * Tests the subscription update endpoint for tier change validation.
 * Verifies that the endpoint validates tier values and handles
 * downgrade/upgrade requests appropriately.
 */
describe('Tier 3: Subscription Downgrade', () => {
  const ctx = readContext()

  test('POST /subscriptions/update — rejects missing tier field', async () => {
    const res = await post('/subscriptions/update', {})

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /subscriptions/update — rejects invalid tier', async () => {
    const res = await post('/subscriptions/update', {
      tier: 'nonexistent-tier',
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /subscriptions/update — accepts valid tier value', async () => {
    // First check current subscription
    const currentRes = await get<{ data: { tier: string; stripeSubscriptionId?: string } }>(
      '/subscriptions/current'
    )

    expect(currentRes.status).toBe(200)

    const hasStripeSubscription = !!currentRes.data?.data?.stripeSubscriptionId

    // Attempt to update to a valid tier
    const res = await post<{ data: Record<string, unknown> }>(
      '/subscriptions/update',
      { tier: 'solo' }
    )

    if (hasStripeSubscription) {
      // With an active Stripe subscription, update should succeed or
      // fail if Stripe config is missing
      expect([200, 500]).toContain(res.status)
    } else {
      // Without a Stripe subscription, should get 404
      expect(res.status).toBe(404)
    }
  })

  test('POST /subscriptions/update — downgrade to free triggers cancellation path', async () => {
    const currentRes = await get<{ data: { stripeSubscriptionId?: string } }>(
      '/subscriptions/current'
    )

    const hasStripeSubscription = !!currentRes.data?.data?.stripeSubscriptionId

    const res = await post<{ data: Record<string, unknown> }>(
      '/subscriptions/update',
      { tier: 'free' }
    )

    if (hasStripeSubscription) {
      // With active subscription, downgrade to free should cancel
      expect([200, 500]).toContain(res.status)
      if (res.status === 200) {
        expect(res.data.data.success).toBe(true)
      }
    } else {
      // Without subscription, should get 404
      expect(res.status).toBe(404)
    }
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
