import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: Members Pagination & API Key Filtering
 *
 * Validates that list endpoints properly pass pagination params to the database
 * and support query-string filters:
 *
 * - GET /orgs/:orgId/members?limit=&offset= returns correct pagination metadata
 * - GET /orgs/:orgId/projects/:projectId/members?limit=&offset= same
 * - GET /orgs/:orgId/api-keys?userId= filters by user
 */

describe('Tier 1: Members Pagination', () => {
  const ctx = readContext()

  // ─── Org Members Pagination ────────────────────────────────────

  test('GET /orgs/:orgId/members returns limit and offset in response', async () => {
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/members`
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res).toHaveProperty('data')
    expect(res).toHaveProperty('limit')
    expect(res).toHaveProperty('offset')
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET /orgs/:orgId/members returns at least one member (the test user)', async () => {
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/members`
    )

    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(1)
  })

  test('GET /orgs/:orgId/members?limit=1 returns at most 1 member', async () => {
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/members?limit=1`
    )

    expect(res.ok).toBe(true)
    expect(res.limit).toBe(1)
    expect(res.data.length).toBeLessThanOrEqual(1)
  })

  test('GET /orgs/:orgId/members respects offset param', async () => {
    // Get total count first
    const allRes = await get<unknown[]>(
      `/orgs/${ctx.orgId}/members`
    )
    expect(allRes.ok).toBe(true)

    const total = allRes.data.length

    // If there's more than 1 member, offset=total should return empty
    if (total > 0) {
      const offsetRes = await get<unknown[]>(
        `/orgs/${ctx.orgId}/members?offset=${total}`
      )
      expect(offsetRes.ok).toBe(true)
      expect(offsetRes.offset).toBe(total)
      expect(offsetRes.data.length).toBe(0)
    }
  })

  // ─── Project Members Pagination ────────────────────────────────

  test('GET /orgs/:orgId/projects/:projectId/members returns pagination metadata', async () => {
    if (!ctx.projectId) return

    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res).toHaveProperty('data')
    expect(res).toHaveProperty('limit')
    expect(res).toHaveProperty('offset')
    expect(typeof res.limit).toBe('number')
    expect(typeof res.offset).toBe('number')
  })

  test('GET /orgs/:orgId/projects/:projectId/members?limit=1 respects limit', async () => {
    if (!ctx.projectId) return

    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members?limit=1`
    )

    expect(res.ok).toBe(true)
    expect(res.limit).toBe(1)
    expect(res.data.length).toBeLessThanOrEqual(1)
  })

  // ─── API Keys userId Filter ────────────────────────────────────

  test('GET /orgs/:orgId/api-keys returns pagination metadata', async () => {
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/api-keys`
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res).toHaveProperty('limit')
    expect(res).toHaveProperty('offset')
  })

  test('GET /orgs/:orgId/api-keys?userId= filters by user', async () => {
    // Get all keys to find a real userId (must be a valid ID for the DB column)
    const allRes = await get<Array<{ userId?: string }>>(
      `/orgs/${ctx.orgId}/api-keys`
    )
    expect(allRes.ok).toBe(true)

    // Find a key that has a userId set — use that userId to test filtering
    const keyWithUser = allRes.data.find(k => k.userId)
    if (!keyWithUser?.userId) return // skip if no keys have userId set

    const filteredRes = await get<Array<{ userId?: string }>>(
      `/orgs/${ctx.orgId}/api-keys?userId=${keyWithUser.userId}`
    )
    expect(filteredRes.ok).toBe(true)

    // Filtered results should be a subset of or equal to all results
    expect(filteredRes.data.length).toBeLessThanOrEqual(allRes.data.length)
    expect(filteredRes.data.length).toBeGreaterThanOrEqual(1)

    // All returned keys should belong to the filtered user
    for (const key of filteredRes.data) {
      if (key.userId) {
        expect(key.userId).toBe(keyWithUser.userId)
      }
    }
  })

  test('GET /orgs/:orgId/api-keys?userId= with valid ID returns empty for unknown user', async () => {
    // Use a valid ID that doesn't match any user
    const fakeUserId = '00000000-0000-0000-0000-000000000099'
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/api-keys?userId=${fakeUserId}`
    )

    expect(res.ok).toBe(true)
    expect(res.data).toEqual([])
  })
})
