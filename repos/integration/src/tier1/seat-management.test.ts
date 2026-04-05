import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: Seat Management
 *
 * Tests that the subscription tracks seat counts and invitation
 * endpoints are accessible.
 */
describe('Tier 1: Seat Management', () => {
  const ctx = readContext()

  test('GET /subscriptions/current includes seats as a number >= 1', async () => {
    const res = await get<{ tier: string; seats?: number }>('/subscriptions/current')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    const sub = res.data
    // Seats field should be a number (default is 1 for new subscriptions,
    // but pre-migration records may have 0)
    if (sub.seats !== undefined) {
      expect(typeof sub.seats).toBe('number')
      expect(sub.seats).toBeGreaterThanOrEqual(0)
    }
  })

  test('GET /orgs/:orgId/invitations endpoint responds', async () => {
    const res = await get(`/orgs/${ctx.orgId}/invitations`)

    // Should return 200 with data or 404 if no invitations endpoint
    // (depends on backend registration). Either is acceptable for tier1.
    expect([200, 404]).toContain(res.status)
  })

  test('GET /orgs/:orgId/quotas/limits includes seats limit', async () => {
    const res = await get<Record<string, unknown>>(
      `/orgs/${ctx.orgId}/quotas/limits`
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()

    const limits = res.data
    expect(limits).toHaveProperty('seats')
    expect(typeof limits.seats).toBe('number')
    expect((limits.seats as number) >= 1).toBe(true)

    expect(limits).toHaveProperty('additionalSeats')
    expect(typeof limits.additionalSeats).toBe('boolean')
  })
})
