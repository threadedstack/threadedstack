import { describe, test, expect } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Subscriptions', () => {
  const ctx = readContext()

  test('GET /subscriptions/current returns 200 with tier and Stripe fields', async () => {
    const res = await get<{
        tier: string
        status: string
        userId: string
        stripeCustomerId?: string | null
        stripeSubscriptionId?: string | null
        stripePriceId?: string | null
        seats?: number
      }>('/subscriptions/current')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(typeof res.data.tier).toBe('string')
    expect(typeof res.data.status).toBe('string')

    // Stripe fields should be present (may be null for free tier)
    const sub = res.data
    expect('stripeCustomerId' in sub || sub.tier === 'free').toBe(true)
  })

  test('GET /subscriptions/plans returns 200 with plan array', async () => {
    const res = await get<Array<{ id: string; name: string; price: number; limits: Record<string, unknown> }>>(
      '/subscriptions/plans'
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res).toHaveProperty('data')

    const plans = res.data
    expect(Array.isArray(plans)).toBe(true)

    // Should have 4 tiers: free, solo, pro, team
    expect(plans.length).toBe(4)

    for (const plan of plans) {
      expect(typeof plan.id).toBe('string')
      expect(typeof plan.name).toBe('string')
      expect(typeof plan.limits).toBe('object')
      expect(plan.limits).not.toBeNull()
    }

    // Verify all tier names are present
    const tierNames = plans.map((p: Record<string, unknown>) => p.id)
    expect(tierNames).toContain('free')
    expect(tierNames).toContain('solo')
    expect(tierNames).toContain('pro')
    expect(tierNames).toContain('team')
  })

  test('GET /subscriptions/invoices returns 200 with array', async () => {
    const res = await get<unknown[]>('/subscriptions/invoices')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('POST /subscriptions/checkout with invalid tier returns error', async () => {
    const res = await post('/subscriptions/checkout', {
      tier: 'nonexistent_tier',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /subscriptions/checkout with missing fields returns error', async () => {
    const res = await post('/subscriptions/checkout', {
      tier: 'solo',
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /subscriptions/checkout for free tier returns error', async () => {
    const res = await post('/subscriptions/checkout', {
      tier: 'free',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /subscriptions/update with invalid tier returns error', async () => {
    const res = await post('/subscriptions/update', {
      tier: 'nonexistent_tier',
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /subscriptions/update with missing tier returns error', async () => {
    const res = await post('/subscriptions/update', {})

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})
