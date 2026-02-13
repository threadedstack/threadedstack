import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Subscriptions', () => {
  const ctx = readContext()

  test('GET /subscriptions/current returns 200 with tier', async () => {
    const res = await get<{ data: { tier: string } }>('/subscriptions/current')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(typeof res.data.data.tier).toBe('string')
  })

  test('GET /subscriptions/plans returns 200 with data', async () => {
    const res = await get<{ data: unknown }>('/subscriptions/plans')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    // Plans may be an array or null depending on Polar configuration
    expect(res.data).toHaveProperty('data')
  })
})
