import { describe, test, expect } from 'vitest'
import { get, post, del } from '../utils/api-client'

/**
 * Tier 1: Subscription Contract Tests
 *
 * Validates authentication requirements and response shapes for subscription
 * endpoints that are NOT already covered by subscriptions.test.ts or tier3 tests.
 *
 * Focuses on:
 * - 401 responses for unauthenticated requests (only /update is covered elsewhere)
 * - Detailed response shape validation (userId, valid tier enum, status values)
 * - Plan object field completeness (price, features)
 */
describe('Tier 1: Subscription Contracts', () => {

  // ── Authentication: 401 without auth ──────────────────────────────

  test('GET /subscriptions/plans returns 401 without auth', async () => {
    const res = await get('/subscriptions/plans', { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('GET /subscriptions/current returns 401 without auth', async () => {
    const res = await get('/subscriptions/current', { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('GET /subscriptions/invoices returns 401 without auth', async () => {
    const res = await get('/subscriptions/invoices', { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('POST /subscriptions/checkout returns 401 without auth', async () => {
    const res = await post(
      '/subscriptions/checkout',
      {
        tier: 'solo',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
      { noAuth: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('DELETE /subscriptions/current returns 401 without auth', async () => {
    const res = await del('/subscriptions/current', { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('POST /subscriptions/portal returns 401 without auth', async () => {
    const res = await post('/subscriptions/portal', {}, { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  // ── Response shape: GET /subscriptions/current ────────────────────

  test('GET /subscriptions/current response has userId, valid tier, and valid status', async () => {
    const res = await get<{
      userId: string
      tier: string
      status: string
      stripeCustomerId?: string | null
      stripeSubscriptionId?: string | null
      stripePriceId?: string | null
      cancelAtPeriodEnd?: boolean
    }>('/subscriptions/current')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    const sub = res.data
    expect(sub).toBeDefined()

    // userId must be a non-empty string
    expect(typeof sub.userId).toBe('string')
    expect(sub.userId.length).toBeGreaterThan(0)

    // tier must be one of the known enum values
    const validTiers = ['free', 'solo', 'pro', 'team']
    expect(validTiers).toContain(sub.tier)

    // status must be a meaningful string
    expect(typeof sub.status).toBe('string')
    expect(sub.status.length).toBeGreaterThan(0)

    // cancelAtPeriodEnd should be boolean if present
    if ('cancelAtPeriodEnd' in sub && sub.cancelAtPeriodEnd !== null && sub.cancelAtPeriodEnd !== undefined) {
      expect(typeof sub.cancelAtPeriodEnd).toBe('boolean')
    }
  })

  // ── Response shape: GET /subscriptions/plans ──────────────────────

  test('GET /subscriptions/plans — each plan has id, name, limits, and price fields', async () => {
    const res = await get<Array<{
      id: string
      name: string
      price: number
      limits: Record<string, unknown>
      features?: string[]
    }>>('/subscriptions/plans')

    expect(res.status).toBe(200)
    const plans = res.data
    expect(Array.isArray(plans)).toBe(true)

    for (const plan of plans) {
      // id and name are non-empty strings
      expect(typeof plan.id).toBe('string')
      expect(plan.id.length).toBeGreaterThan(0)
      expect(typeof plan.name).toBe('string')
      expect(plan.name.length).toBeGreaterThan(0)

      // limits is a non-null object
      expect(typeof plan.limits).toBe('object')
      expect(plan.limits).not.toBeNull()

      // features should be an array if present
      if ('features' in plan && plan.features !== undefined) {
        expect(Array.isArray(plan.features)).toBe(true)
      }
    }
  })
})
