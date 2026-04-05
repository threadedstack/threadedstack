import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Organizations', () => {
  const ctx = readContext()

  test('GET /orgs returns 200 with paginated data array', async () => {
    const res = await get<unknown[]>('/orgs')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET /orgs/:orgId returns 200 with matching org', async () => {
    const res = await get<{ id: string }>(`/orgs/${ctx.orgId}`)

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()
    expect(res.data.id).toBe(ctx.orgId)
  })

  test('GET /orgs?limit=1 returns at most 1 item', async () => {
    const res = await get<unknown[]>(
      '/orgs?limit=1'
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeLessThanOrEqual(1)
    expect(res.limit).toBe(1)
  })

  test('GET /orgs includes userRole on each org in response', async () => {
    const res = await get<Record<string, unknown>[]>('/orgs')

    expect(res.status).toBe(200)
    expect(res.data.length).toBeGreaterThan(0)

    for (const org of res.data) {
      expect(org).toHaveProperty('userRole')
      expect(typeof org.userRole).toBe('string')
    }
  })

  test('GET /orgs/:orgId includes userRole in response', async () => {
    const res = await get<Record<string, unknown>>(`/orgs/${ctx.orgId}`)

    expect(res.status).toBe(200)
    expect(res.data).toHaveProperty('userRole')
    expect(typeof res.data.userRole).toBe('string')
  })
})
