import { describe, test, expect } from 'vitest'
import { get, put } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: validateIdParams Middleware
 *
 * Validates that route params named *Id use nanoid(10) format,
 * EXCEPT userId which must be UUID format (from Neon Auth).
 *
 * Uses PUT /orgs/:orgId/members/:userId which has both param types.
 */
describe('Tier 1: validateIdParams Middleware', () => {
  const ctx = readContext()

  // ─── nanoid validation ──────────────────────────────────────────────

  test('GET with invalid orgId format → 400', async () => {
    const res = await get(`/orgs/bad-format!!`)
    expect(res.status).toBe(400)
  })

  test('GET with valid nanoid orgId passes ID validation', async () => {
    const res = await get(`/orgs/${ctx.orgId}`)
    expect(res.status).not.toBe(400)
  })

  // ─── userId UUID validation ─────────────────────────────────────────

  test('PUT member role with invalid userId format → 400', async () => {
    const res = await put(
      `/orgs/${ctx.orgId}/members/not-a-uuid`,
      { roleType: 'member' }
    )

    expect(res.status).toBe(400)
  })

  test('PUT member role with nanoid userId format → 400', async () => {
    const res = await put(
      `/orgs/${ctx.orgId}/members/V1StGXR8_Z`,
      { roleType: 'member' }
    )

    expect(res.status).toBe(400)
  })

  test('PUT member role with valid UUID userId passes ID validation', async () => {
    // Always use a non-existent UUID — never target a real org member.
    // This test only verifies UUID format passes the validateIdParams middleware.
    const fakeMemberId = `ffffffff-ffff-ffff-ffff-ffffffffffff`
    const res = await put(
      `/orgs/${ctx.orgId}/members/${fakeMemberId}`,
      { roleType: 'member' }
    )

    // Should NOT be 400 (format error) — expected 403 or 404 for non-existent member.
    expect(res.status).not.toBe(400)
  })
})
