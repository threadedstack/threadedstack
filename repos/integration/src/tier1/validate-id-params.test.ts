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
      { type: 'member' }
    )

    expect(res.status).toBe(400)
  })

  test('PUT member role with nanoid userId format → 400', async () => {
    const res = await put(
      `/orgs/${ctx.orgId}/members/V1StGXR8_Z`,
      { type: 'member' }
    )

    expect(res.status).toBe(400)
  })

  test('PUT member role with valid UUID userId passes ID validation', async () => {
    const memberId = ctx.targetMemberUserId || `00000000-0000-0000-0000-000000000002`
    const res = await put(
      `/orgs/${ctx.orgId}/members/${memberId}`,
      { type: 'member' }
    )

    // Should NOT be 400 (format error) — could be 403, 404, etc.
    expect(res.status).not.toBe(400)
  })
})
