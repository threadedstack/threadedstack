import { describe, test, expect } from 'vitest'
import { get, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: validateIdParams Middleware
 *
 * Validates that route params named "id" or ending in "Id" accept
 * either nanoid(10) or UUID format. Rejects anything else with 400.
 *
 * Uses PUT /orgs/:orgId/members/:userId which has both param types.
 */
describe('Tier 1: validateIdParams Middleware', () => {
  const ctx = readContext()

  // ─── Invalid format rejection ───────────────────────────────────────

  test('GET with invalid orgId format → 400', async () => {
    const res = await get(`/orgs/bad-format!!`)
    expect(res.status).toBe(400)
  })

  test('PUT member role with truly invalid userId format → 400', async () => {
    const res = await put(
      `/orgs/${ctx.orgId}/members/!!!invalid`,
      { roleType: 'member' }
    )

    expect(res.status).toBe(400)
  })

  // ─── Valid format acceptance ────────────────────────────────────────

  test('GET with valid nanoid orgId passes ID validation', async () => {
    const res = await get(`/orgs/${ctx.orgId}`)
    expect(res.status).not.toBe(400)
  })

  test('PUT member role with valid UUID userId passes ID validation', async () => {
    const fakeMemberId = `ffffffff-ffff-ffff-ffff-ffffffffffff`
    const res = await put(
      `/orgs/${ctx.orgId}/members/${fakeMemberId}`,
      { roleType: 'member' }
    )

    expect(res.status).not.toBe(400)
  })

  test('PUT member role with nanoid userId passes ID validation', async () => {
    const res = await put(
      `/orgs/${ctx.orgId}/members/V1StGXR8_Z`,
      { roleType: 'member' }
    )

    expect(res.status).not.toBe(400)
  })
})
