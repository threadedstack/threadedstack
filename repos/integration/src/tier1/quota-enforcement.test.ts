import { describe, test, expect } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: Quota Enforcement
 *
 * Tests quota endpoints for the new 6-field schema:
 * projects, compute, threads, messages, endpoints, secrets.
 */
describe('Tier 1: Quota Enforcement', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/quotas returns quota data with 6 usage fields', async () => {
    const res = await get<{ data: Record<string, unknown> }>(
      `/orgs/${ctx.orgId}/quotas`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()

    const quota = res.data.data

    expect(quota).toHaveProperty('orgId')
    expect(quota).toHaveProperty('period')
    expect(typeof quota.period).toBe('string')

    // Verify the 6 quota usage fields
    const usageFields = [
      'projects',
      'compute',
      'threads',
      'messages',
      'endpoints',
      'secrets',
    ]

    for (const field of usageFields) {
      expect(quota).toHaveProperty(field)
      expect(typeof quota[field]).toBe('number')
    }
  })

  test('GET /orgs/:orgId/quotas/limits returns TPlanLimits shape', async () => {
    const res = await get<{ data: Record<string, unknown> }>(
      `/orgs/${ctx.orgId}/quotas/limits`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()

    const limits = res.data.data

    // Verify the limits match TPlanLimits shape
    const expectedKeys = [
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

    for (const key of expectedKeys) {
      expect(limits).toHaveProperty(key)
    }

    // Numeric fields should be numbers (can be -1 for unlimited)
    for (const key of expectedKeys.filter(k => k !== 'additionalSeats')) {
      expect(typeof limits[key]).toBe('number')
    }

    // additionalSeats should be boolean
    expect(typeof limits.additionalSeats).toBe('boolean')
  })

  test('POST /orgs/:orgId/quotas/check returns {allowed, current, limit, remaining}', async () => {
    const res = await post<{ data: { allowed: boolean; current: number; limit: number; remaining: number } }>(
      `/orgs/${ctx.orgId}/quotas/check`,
      { resource: 'projects', amount: 1 }
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()

    const check = res.data.data
    expect(typeof check.allowed).toBe('boolean')
    expect(typeof check.current).toBe('number')
    expect(typeof check.limit).toBe('number')
    expect(typeof check.remaining).toBe('number')

    // remaining should be -1 (unlimited) or >= 0
    expect(check.remaining >= -1).toBe(true)
  })

  test('POST /orgs/:orgId/quotas/check rejects missing resource field', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/quotas/check`,
      { amount: 1 }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('POST /orgs/:orgId/quotas/check rejects invalid resource name', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/quotas/check`,
      { resource: 'nonexistent_resource', amount: 1 }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('GET /orgs/:orgId/quotas period format is YYYY-MM', async () => {
    const res = await get<{ data: { period: string } }>(
      `/orgs/${ctx.orgId}/quotas`
    )

    expect(res.status).toBe(200)
    const period = res.data.data.period
    expect(period).toMatch(/^\d{4}-\d{2}$/)
  })
})
