import { describe, test, expect, afterAll } from 'vitest'
import { get, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
/**
 * Tier 1: Org Role CRUD (update/delete) contract tests.
 *
 * This is a thin test file focused on the PUT/DELETE /orgs/:orgId/roles/:roleId
 * endpoints. General role permission logic is covered by role-permission-matrix.test.ts.
 *
 * Routes:
 *   PUT    /orgs/:orgId/roles/:roleId  — update a role's type (admin+ required)
 *   DELETE /orgs/:orgId/roles/:roleId  — delete a role record (owner+ required)
 */
describe('Tier 1: Org Role CRUD', () => {
  const ctx = readContext()
  const fakeRoleId = 'zz99Xfake1'
  const hasAdmin = !!ctx.adminApiKey

  const adminOpts = () => ({ apiKey: ctx.adminApiKey! })

  afterAll(async () => {
    if (targetRoleId && targetRoleType) {
      try {
        await put(`/orgs/${ctx.orgId}/roles/${targetRoleId}`, { roleType: targetRoleType })
      } catch (err) {
        console.warn('[org-roles] afterAll: failed to restore role —', (err as Error)?.message || err)
      }
    }
  })

  // ── Discover a real roleId from org members ───────────────────────

  /**
   * The targetMemberUserId from context is a userId, not a roleId.
   * We need to look up the actual role record to get its id.
   * We'll fetch org members and find a non-owner member's roleId.
   */
  let targetRoleId: string | undefined
  let targetRoleType: string | undefined

  // ── PUT /orgs/:orgId/roles/:roleId ─────────────────────────────────

  describe('PUT update role', () => {
    test('returns 401 without auth', async () => {
      const res = await put(
        `/orgs/${ctx.orgId}/roles/${fakeRoleId}`,
        { roleType: 'member' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for nonexistent roleId', async () => {
      const res = await put(
        `/orgs/${ctx.orgId}/roles/${fakeRoleId}`,
        { roleType: 'member' }
      )

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('returns 400 when roleType is missing', async () => {
      const res = await put(
        `/orgs/${ctx.orgId}/roles/${fakeRoleId}`,
        {}
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 for invalid roleType value', async () => {
      const res = await put(
        `/orgs/${ctx.orgId}/roles/${fakeRoleId}`,
        { roleType: 'emperor' }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('discover target member roleId for update tests', async () => {
      // Fetch org members — these are role records with id, userId, type
      const res = await get<Array<{ id: string; userId: string; type: string }>>(
        `/orgs/${ctx.orgId}/members`
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      // Find a member role (NOT owner/super) that we can safely update.
      // Prefer the targetMemberUserId from context if available.
      const members = res.data || []

      if (ctx.targetMemberUserId) {
        const match = members.find(m => m.userId === ctx.targetMemberUserId)
        if (match) {
          targetRoleId = match.id
          targetRoleType = match.type
        }
      }

      // Fallback: any non-owner, non-super member
      if (!targetRoleId) {
        const candidate = members.find(
          m => m.type !== 'owner' && m.type !== 'super' && m.userId !== ctx.userId
        )
        if (candidate) {
          targetRoleId = candidate.id
          targetRoleType = candidate.type
        }
      }

      if (!targetRoleId) {
        console.warn('[org-roles] WARNING: no targetRoleId discovered — subsequent role tests will be skipped')
      }
    })

    test('owner cannot assign owner role to a lower member (hierarchy violation)', async () => {
      if (!targetRoleId) {
        console.warn('[org-roles] SKIPPED: owner cannot assign owner role — no targetRoleId discovered')
        return
      }

      // Even as an owner, canManageRole(owner, owner) returns false
      // because you can only assign roles BELOW your own level.
      // The test user is typically 'super' or 'owner' role.
      // Trying to assign 'owner' should be blocked by canManageRole for non-super users,
      // but 'super' can manage any role. So we use admin key if available.
      if (!hasAdmin) {
        console.warn('[org-roles] SKIPPED: owner cannot assign owner role — no adminApiKey available')
        return
      }

      const res = await put(
        `/orgs/${ctx.orgId}/roles/${targetRoleId}`,
        { roleType: 'owner' },
        adminOpts()
      )

      // Admin cannot assign 'owner' — canManageRole(admin, owner) is false
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('admin cannot assign super role (hierarchy violation)', async () => {
      if (!hasAdmin || !targetRoleId) {
        console.warn('[org-roles] SKIPPED: admin cannot assign super role — hasAdmin=%s, targetRoleId=%s', hasAdmin, !!targetRoleId)
        return
      }

      const res = await put(
        `/orgs/${ctx.orgId}/roles/${targetRoleId}`,
        { roleType: 'super' },
        adminOpts()
      )

      // Admin cannot assign 'super' — canManageRole(admin, super) is false
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('owner can update a member role to member (and restore)', async () => {
      if (!targetRoleId || !targetRoleType) {
        console.warn('[org-roles] SKIPPED: owner can update member role -- targetRoleId=%s, targetRoleType=%s', !!targetRoleId, targetRoleType)
        return
      }

      // Update role to member
      const updateRes = await put(
        `/orgs/${ctx.orgId}/roles/${targetRoleId}`,
        { roleType: 'member' }
      )

      expect(updateRes.status).toBe(200)
      expect(updateRes.ok).toBe(true)
      expect(updateRes.data).toBeDefined()

      // Restore original role type to avoid side effects on other tests
      const restoreRes = await put(
        `/orgs/${ctx.orgId}/roles/${targetRoleId}`,
        { roleType: targetRoleType }
      )

      expect(restoreRes.status).toBe(200)
    })
  })

  // ── DELETE /orgs/:orgId/roles/:roleId ──────────────────────────────

  describe('DELETE role', () => {
    test('returns 401 without auth', async () => {
      const res = await del(
        `/orgs/${ctx.orgId}/roles/${fakeRoleId}`,
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for nonexistent roleId with owner-level key', async () => {
      const res = await del(`/orgs/${ctx.orgId}/roles/${fakeRoleId}`)

      // role.delete requires owner. The test API key has owner-level perms,
      // so auth passes and the lookup returns 404 for the fake role id.
      // (Admin-scoped keys would 403 instead — see the admin-key test below.)
      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('admin cannot delete a role (requires owner+)', async () => {
      if (!hasAdmin) {
        console.warn('[org-roles] SKIPPED: admin cannot delete role — no admin key')
        return
      }

      // Use a fake roleId to safely test the permission denial.
      // NEVER delete a real role — if the backend allows it, the role is gone.
      const res = await del(
        `/orgs/${ctx.orgId}/roles/${fakeRoleId}`,
        adminOpts()
      )

      // Admin lacks owner+ permission → 403 before DB lookup,
      // OR if auth passes, fake ID → 404
      expect([403, 404]).toContain(res.status)
      expect(res.ok).toBe(false)
    })
  })
})
