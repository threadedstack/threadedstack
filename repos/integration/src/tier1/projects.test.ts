import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Projects', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/projects returns 200 with paginated data array', async () => {
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/projects`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })
})
