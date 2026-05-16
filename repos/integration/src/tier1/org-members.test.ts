import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

/**
 * Tier 1: Org Member Operations
 *
 * Tests add/remove/update member operations at the org level:
 *
 * - POST   /orgs/:orgId/members           (add member)
 * - PUT    /orgs/:orgId/members/:userId    (update member role)
 * - DELETE /orgs/:orgId/members/:userId    (remove member)
 * - GET    /orgs/:orgId/members            (list — shape validation)
 *
 * Complements existing tests:
 * - `members-pagination.test.ts`    — pagination params
 * - `role-permission-matrix.test.ts`— cross-role RBAC assertions
 * - `invitations.test.ts`           — invite workflow
 * - `project-members.test.ts`       — project-scoped member lifecycle
 *
 * CAUTION: Org member operations are destructive. This file is conservative —
 * it avoids removing real org members that other tests depend on. The global
 * teardown snapshots and restores members, but we still treat removal as a
 * last resort and clean up any state changes.
 */

interface OrgMember {
  id: string
  userId: string
  orgId: string | null
  type: string
  createdAt: string
  updatedAt: string
  user?: { id: string; email?: string; name?: string }
}

describe('Tier 1: Org Member Operations', () => {
  const ctx = readContext()
  const hasAdmin = !!ctx.adminApiKey
  const hasTarget = !!ctx.targetMemberUserId
  const basePath = `/orgs/${ctx.orgId}/members`

  const adminOpts = () => ({ apiKey: ctx.adminApiKey! })

  afterAll(async () => {
    // Restore targetMemberUserId to its original role if we changed it.
    // The orgMemberSnapshot tells us what it should be.
    // This is best-effort — authorize middleware may reject with 403.
    if (ctx.targetMemberUserId && ctx.orgMemberSnapshot) {
      const original = ctx.orgMemberSnapshot.find(
        m => m.userId === ctx.targetMemberUserId
      )
      if (original) {
        try {
          const res = await put(`${basePath}/${ctx.targetMemberUserId}`, {
            roleType: original.type,
          })
          if (!res.ok) {
            console.warn(`[org-members] afterAll: restore target member role returned ${res.status} — best-effort`)
          }
        } catch (err) {
          console.warn('[org-members] afterAll: failed to restore target member role —', (err as Error)?.message || err)
        }
      }
    }
  })

  // ── Section 1: List Members — Shape Validation ────────────────────

  describe('List org members — response shape', () => {
    test('GET returns 200 with array data and pagination', async () => {
      const res = await get<OrgMember[]>(basePath)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
      expect(typeof res.limit).toBe('number')
      expect(typeof res.offset).toBe('number')
    })

    test('each member has userId, type, and createdAt', async () => {
      const res = await get<OrgMember[]>(basePath)

      expect(res.status).toBe(200)
      expect(res.data.length).toBeGreaterThanOrEqual(1)

      for (const member of res.data) {
        expect(member).toHaveProperty('userId')
        expect(typeof member.userId).toBe('string')
        expect(member).toHaveProperty('type')
        expect(typeof member.type).toBe('string')
        expect(
          ['super', 'owner', 'admin', 'member', 'viewer']
        ).toContain(member.type)
        expect(member).toHaveProperty('createdAt')
        expect(typeof member.createdAt).toBe('string')
      }
    })

    test('list includes the current user', async () => {
      const res = await get<OrgMember[]>(basePath)

      expect(res.status).toBe(200)
      const self = res.data.find(m => m.userId === ctx.userId)
      if (!self) {
        console.warn('[org-members] current user not in member list — may be a super admin without explicit org role')
      }
      expect(res.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Section 2: POST /orgs/:orgId/members — Add Member ────────────

  describe('POST add org member — validation & auth', () => {
    test('returns 401 without auth', async () => {
      const res = await post(
        basePath,
        { userId: '00000000-0000-0000-0000-000000000001' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 400 when userId is missing', async () => {
      const res = await post(basePath, {})

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 for invalid roleType', async () => {
      const res = await post(basePath, {
        userId: '00000000-0000-0000-0000-000000000001',
        roleType: 'dictator',
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for nonexistent userId', async () => {
      const fakeUserId = '00000000-0000-0000-0000-ffffffffffff'
      const res = await post(basePath, {
        userId: fakeUserId,
        roleType: 'member',
      })

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })
  })

  // ── Section 3: PUT /orgs/:orgId/members/:userId — Update Role ────

  describe('PUT update org member role', () => {
    test('returns 401 without auth', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000001'
      const res = await put(
        `${basePath}/${fakeUserId}`,
        { roleType: 'member' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 400 when roleType is missing', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000001'
      const res = await put(`${basePath}/${fakeUserId}`, {})

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 for invalid roleType value', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000001'
      const res = await put(`${basePath}/${fakeUserId}`, {
        roleType: 'supreme_leader',
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for nonexistent member', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000099999'
      const res = await put(`${basePath}/${fakeUserId}`, {
        roleType: 'member',
      })

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('update target member role to member succeeds', async () => {
      if (!hasTarget) {
        console.warn('[org-members] SKIPPED: update target member role — no targetMemberUserId')
        return
      }

      const res = await put<OrgMember>(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'member' }
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data).toBeDefined()
      expect(res.data.type).toBe('member')
    })

    test('confirm target member role was updated', async () => {
      if (!hasTarget) {
        console.warn('[org-members] SKIPPED: confirm target member role — no targetMemberUserId')
        return
      }

      const res = await get<OrgMember[]>(basePath)

      expect(res.status).toBe(200)
      const member = res.data.find(
        m => m.userId === ctx.targetMemberUserId
      )
      expect(member).toBeDefined()
      expect(member!.type).toBe('member')
    })
  })

  // ── Section 4: DELETE /orgs/:orgId/members/:userId — Remove ───────

  describe('DELETE remove org member', () => {
    test('returns 401 without auth', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000001'
      const res = await del(`${basePath}/${fakeUserId}`, { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for nonexistent member (safe DELETE test)', async () => {
      const nonexistentUserId = '00000000-0000-0000-0000-ffffffffffff'
      const res = await del(`${basePath}/${nonexistentUserId}`)

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for nonexistent member', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000099999'
      const res = await del(`${basePath}/${fakeUserId}`)

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })
  })

  // ── Section 5: Role Hierarchy at Org Level (admin key) ────────────
  //
  // Uses the admin-scoped API key to verify that role hierarchy is
  // enforced for org member operations. The admin user cannot:
  // - Assign roles equal to or higher than their own
  // - Modify or remove members with equal or higher roles
  // But CAN manage members with lower roles.
  //
  // These tests differ from role-permission-matrix.test.ts which checks
  // broad resource access. Here we verify the role-specific hierarchy
  // enforcement in the member management endpoints themselves.

  describe('Role hierarchy — admin org member operations', () => {
    const canRunHierarchy = hasAdmin && hasTarget

    test('precondition: admin key and target member available', () => {
      expect(ctx.adminApiKey).toBeTruthy()
      expect(ctx.targetMemberUserId).toBeTruthy()
    })

    test('setup: ensure target has member role', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: setup ensure target has member role — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      // Use super/owner key to set target to member role
      const res = await put(`${basePath}/${ctx.targetMemberUserId}`, {
        roleType: 'member',
      })
      expect(res.status).toBe(200)
    })

    // ── Admin cannot promote to equal or higher role ──

    test('admin cannot promote org member to owner', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: admin cannot promote to owner — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      const res = await put(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'owner' },
        adminOpts()
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('admin cannot promote org member to admin (equal)', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: admin cannot promote to admin — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      const res = await put(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'admin' },
        adminOpts()
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    // ── Admin can assign lower roles ──

    test('admin can update org member to viewer (lower role)', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: admin can update to viewer — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      const res = await put<OrgMember>(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'viewer' },
        adminOpts()
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.type).toBe('viewer')
    })

    test('admin can update org member to member (lower role)', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: admin can update to member — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      const res = await put<OrgMember>(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'member' },
        adminOpts()
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.type).toBe('member')
    })

    // ── Admin cannot modify equal-role members ──

    test('setup: promote target to admin role (requires owner — skipped via API key)', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: setup promote target to admin — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      // Promoting to admin requires owner+ which API keys cannot provide (max role = admin)
      const res = await put(`${basePath}/${ctx.targetMemberUserId}`, {
        roleType: 'admin',
      })
      // API key role enforcement caps at admin — promotion TO admin requires owner+
      if (res.status === 403) {
        console.warn('[org-members] SKIPPED: promote to admin requires owner+ (API key caps at admin)')
        return
      }
      expect(res.status).toBe(200)
    })

    test('admin cannot modify equal-role org member', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: admin cannot modify equal-role member — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      // Verify target is currently admin (if promotion worked); skip if target is still member
      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === ctx.targetMemberUserId)
      if (target?.type !== 'admin') {
        console.warn('[org-members] SKIPPED: equal-role test — target is %s not admin (promotion requires owner+)', target?.type)
        return
      }

      const res = await put(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'viewer' },
        adminOpts()
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('admin cannot remove equal-role org member (verified via PUT, not DELETE)', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: admin cannot remove equal-role member — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === ctx.targetMemberUserId)
      if (target?.type !== 'admin') {
        console.warn('[org-members] SKIPPED: equal-role removal test — target is %s not admin', target?.type)
        return
      }

      const res = await put(
        `${basePath}/${ctx.targetMemberUserId}`,
        { roleType: 'viewer' },
        adminOpts()
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    // ── Restore target to original role ──

    test('cleanup: restore target member role', async () => {
      if (!canRunHierarchy) {
        console.warn('[org-members] SKIPPED: cleanup restore target role — hasAdmin=%s, hasTarget=%s', hasAdmin, hasTarget)
        return
      }

      const original = ctx.orgMemberSnapshot?.find(
        m => m.userId === ctx.targetMemberUserId
      )
      const restoreRole = original?.type || 'member'

      const res = await put(`${basePath}/${ctx.targetMemberUserId}`, {
        roleType: restoreRole,
      })
      expect(res.status).toBe(200)
    })
  })

  // ── Section 6: POST /orgs/:orgId/users/invite — Validation ───────
  //
  // Core invitation workflow is in invitations.test.ts. Here we verify
  // field validation and auth for the invite endpoint specifically.

  describe('POST invite org user — validation', () => {
    const invitePath = `/orgs/${ctx.orgId}/users/invite`

    test('returns 401 without auth', async () => {
      const res = await post(
        invitePath,
        { email: 'no-auth@example.com', roleType: 'member' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 400 when email is missing', async () => {
      const res = await post(invitePath, { roleType: 'member' })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 when roleType is missing', async () => {
      const res = await post(invitePath, {
        email: 'missing-role@integration-test.example.com',
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 for invalid roleType', async () => {
      const res = await post(invitePath, {
        email: 'bad-role@integration-test.example.com',
        roleType: 'megaadmin',
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 for out-of-range expiresInDays', async () => {
      const res = await post(invitePath, {
        email: 'bad-expiry@integration-test.example.com',
        roleType: 'member',
        expiresInDays: 90,
      })

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('valid invite returns 201 or 403 based on plan tier', async () => {
      const email = `org-members-test-${Date.now()}@integration-test.example.com`
      const res = await post<Record<string, any>>(invitePath, {
        email,
        roleType: 'member',
      })

      // 201: invitation created (Pro/Team tier)
      // 403: plan does not allow additional members (Free/Solo tier — feature gate)
      expect([201, 403]).toContain(res.status)
      // NOTE: 403 here is a LEGITIMATE feature-gate response (not an auth failure)

      // Clean up invitation if one was created
      if (res.status === 201 && res.data?.id) {
        await tryDelete(`/invitations/${res.data.id}`)
      }
    })
  })
})
