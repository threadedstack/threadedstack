import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: API Keys', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/api-keys returns 200 with data array', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/api-keys`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  test('api-keys response does not leak keyHash', async () => {
    const res = await get<{ data: Record<string, unknown>[] }>(
      `/orgs/${ctx.orgId}/api-keys`
    )

    expect(res.status).toBe(200)

    for (const key of res.data.data) {
      expect(key).not.toHaveProperty('keyHash')
    }
  })
})
