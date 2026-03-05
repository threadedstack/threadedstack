import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Organizations', () => {
  const ctx = readContext()

  test('GET /orgs returns 200 with paginated data array', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>('/orgs')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(typeof res.data.limit).toBe('number')
    expect(typeof res.data.offset).toBe('number')
  })

  test('GET /orgs/:orgId returns 200 with matching org', async () => {
    const res = await get<{ data: { id: string } }>(`/orgs/${ctx.orgId}`)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.id).toBe(ctx.orgId)
  })

  test('GET /orgs?limit=1 returns at most 1 item', async () => {
    const res = await get<{ data: unknown[]; limit: number; offset: number }>(
      '/orgs?limit=1'
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(res.data.data.length).toBeLessThanOrEqual(1)
    expect(res.data.limit).toBe(1)
  })

  test('GET /orgs includes userRole on each org in response', async () => {
    const res = await get<{ data: Record<string, unknown>[] }>('/orgs')

    expect(res.status).toBe(200)
    expect(res.data.data.length).toBeGreaterThan(0)

    for (const org of res.data.data) {
      expect(org).toHaveProperty('userRole')
      expect(typeof org.userRole).toBe('string')
    }
  })

  test('GET /orgs/:orgId includes userRole in response', async () => {
    const res = await get<{ data: Record<string, unknown> }>(`/orgs/${ctx.orgId}`)

    expect(res.status).toBe(200)
    expect(res.data.data).toHaveProperty('userRole')
    expect(typeof res.data.data.userRole).toBe('string')
  })
})
