import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Secrets', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/secrets returns 200 with data array', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      `/orgs/${ctx.orgId}/secrets`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  test('admin key includes encryptedValue, secrets have expected shape', async () => {
    const res = await get<{ data: Record<string, unknown>[] }>(
      `/orgs/${ctx.orgId}/secrets`
    )

    expect(res.status).toBe(200)

    // Admin-scoped API key should see encryptedValue (access control working)
    for (const secret of res.data.data) {
      expect(secret).toHaveProperty('id')
      expect(secret).toHaveProperty('name')
      expect(secret).toHaveProperty('encryptedValue')
    }
  })
})
