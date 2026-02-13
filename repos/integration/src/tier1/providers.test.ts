import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Providers', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/providers returns 200 with data array', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/providers`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
  })
})
