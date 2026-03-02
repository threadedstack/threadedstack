import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

interface RoleMember {
  id: string
  userId: string
  projectId: string
  type: string
  orgId: string | null
  name: string | null
  createdAt: string
  updatedAt: string
}

interface ListResponse {
  data: RoleMember[]
  limit: number
  offset: number
}

interface SingleResponse {
  data: RoleMember
}

describe('Tier 1: Project Members', () => {
  const ctx = readContext()
  const basePath = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`

  // Track members added during tests for cleanup
  const addedMemberUserIds: string[] = []

  afterAll(async () => {
    for (const userId of addedMemberUserIds) {
      // Downgrade to viewer first in case member has owner role (backend blocks owner deletion)
      try { await put(`${basePath}/${userId}`, { type: 'viewer' }) } catch {}
      await tryDelete(`${basePath}/${userId}`)
    }
  })

  // ── Section 1: List Project Members ──────────────────────────────────

  describe('List project members', () => {
    test('GET returns 200 with data array', async () => {
      const res = await get<ListResponse>(basePath)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(typeof res.data.limit).toBe('number')
      expect(typeof res.data.offset).toBe('number')
    })

    test('returns limit and offset metadata from query params', async () => {
      const res = await get<ListResponse>(`${basePath}?limit=1&offset=0`)

      expect(res.status).toBe(200)
      expect(res.data.limit).toBe(1)
      expect(res.data.offset).toBe(0)
      // Note: backend echoes pagination params but doesn't apply them to data
      expect(Array.isArray(res.data.data)).toBe(true)
    })

    test('each member has expected shape', async () => {
      const res = await get<ListResponse>(basePath)
      if (!res.data.data.length) return // skip if no members yet

      const member = res.data.data[0]
      expect(member).toHaveProperty('id')
      expect(member).toHaveProperty('userId')
      expect(member).toHaveProperty('projectId')
      expect(member).toHaveProperty('type')
      expect(typeof member.id).toBe('string')
      expect(typeof member.userId).toBe('string')
      expect(member.projectId).toBe(ctx.projectId)
      expect(['owner', 'admin', 'member', 'viewer']).toContain(member.type)
    })
  })

  // ── Section 2: Authentication ────────────────────────────────────────

  describe('Authentication', () => {
    test('GET without auth returns 401', async () => {
      const res = await get(basePath, { noAuth: true })
      expect(res.status).toBe(401)
    })

    test('POST without auth returns 401', async () => {
      const res = await post(basePath, { userId: 'fake-user' }, { noAuth: true })
      expect(res.status).toBe(401)
    })
  })

  // ── Section 3: Validation Errors ─────────────────────────────────────

  describe('Validation errors', () => {
    test('POST with missing userId returns 400', async () => {
      const res = await post(basePath, {})
      expect(res.status).toBe(400)
    })

    test('POST with non-org-member userId returns 400', async () => {
      const res = await post(basePath, { userId: '00000000-0000-0000-0000-00000000ffff' })
      expect(res.status).toBe(400)
    })

    test('PUT with missing type returns 400', async () => {
      const res = await put(`${basePath}/${ctx.userId}`, {})
      expect(res.status).toBe(400)
    })
  })

  // ── Section 4: Not Found ─────────────────────────────────────────────

  describe('Nonexistent member', () => {
    const fakeUserId = '00000000-0000-0000-0000-000099999999'

    test('PUT on nonexistent member returns 404', async () => {
      const res = await put(`${basePath}/${fakeUserId}`, { type: 'viewer' })
      expect(res.status).toBe(404)
    })

    test('DELETE on nonexistent member returns 404', async () => {
      const res = await del(`${basePath}/${fakeUserId}`)
      expect(res.status).toBe(404)
    })
  })

  // ── Section 5–6: Member Lifecycle ────────────────────────────────────

  describe('Member lifecycle', () => {
    let secondUserId: string | null = null

    // Discover a second org member to use for add/update/remove lifecycle
    test('discover second org member', async () => {
      const orgMembersRes = await get<ListResponse>(`/orgs/${ctx.orgId}/members`)
      expect(orgMembersRes.status).toBe(200)

      const orgMembers = orgMembersRes.data.data
      const otherMember = orgMembers.find((m: RoleMember) => m.userId !== ctx.userId)
      if (!otherMember) {
        console.warn('Only one org member exists — skipping lifecycle tests')
        return
      }
      secondUserId = otherMember.userId
    })

    test('POST adds member with viewer role', async () => {
      if (!secondUserId) return // skip if no second member

      // First remove them from the project if already a member (cleanup from prior runs)
      await tryDelete(`${basePath}/${secondUserId}`)

      const res = await post<SingleResponse>(basePath, {
        userId: secondUserId,
        type: 'viewer',
      })

      expect(res.status).toBe(201)
      expect(res.data.data.userId).toBe(secondUserId)
      expect(res.data.data.type).toBe('viewer')
      expect(res.data.data.projectId).toBe(ctx.projectId)
      addedMemberUserIds.push(secondUserId)
    })

    test('GET confirms new member in list', async () => {
      if (!secondUserId) return

      const res = await get<ListResponse>(basePath)
      expect(res.status).toBe(200)
      const found = res.data.data.find((m: RoleMember) => m.userId === secondUserId)
      expect(found).toBeDefined()
      expect(found!.type).toBe('viewer')
    })

    test('PUT updates member role to member', async () => {
      if (!secondUserId) return

      const res = await put<SingleResponse>(`${basePath}/${secondUserId}`, {
        type: 'member',
      })

      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('member')
    })

    test('GET confirms updated role', async () => {
      if (!secondUserId) return

      const res = await get<ListResponse>(basePath)
      expect(res.status).toBe(200)
      const found = res.data.data.find((m: RoleMember) => m.userId === secondUserId)
      expect(found).toBeDefined()
      expect(found!.type).toBe('member')
    })

    test('DELETE removes member', async () => {
      if (!secondUserId) return

      const res = await del<SingleResponse>(`${basePath}/${secondUserId}`)
      expect(res.status).toBe(200)
      // Remove from cleanup list since already deleted
      const idx = addedMemberUserIds.indexOf(secondUserId)
      if (idx !== -1) addedMemberUserIds.splice(idx, 1)
    })

    test('GET confirms member removed', async () => {
      if (!secondUserId) return

      const res = await get<ListResponse>(basePath)
      expect(res.status).toBe(200)
      const found = res.data.data.find((m: RoleMember) => m.userId === secondUserId)
      expect(found).toBeUndefined()
    })
  })

  // ── Section 7: Role Assignment (super user can assign all roles) ────

  describe('Role assignment', () => {
    let secondUserId: string | null = null

    test('setup: add member for role tests', async () => {
      const orgMembersRes = await get<ListResponse>(`/orgs/${ctx.orgId}/members`)
      const orgMembers = orgMembersRes.data.data
      const otherMember = orgMembers.find((m: RoleMember) => m.userId !== ctx.userId)
      if (!otherMember) {
        console.warn('Only one org member — skipping role assignment tests')
        return
      }
      secondUserId = otherMember.userId

      // Ensure they're a project member first (as viewer)
      await tryDelete(`${basePath}/${secondUserId}`)
      const addRes = await post(basePath, { userId: secondUserId, type: 'viewer' })
      expect(addRes.status).toBe(201)
      addedMemberUserIds.push(secondUserId)
    })

    test('super user can assign admin role', async () => {
      if (!secondUserId) return

      // Test user has super org role — can assign any role
      const res = await put<SingleResponse>(`${basePath}/${secondUserId}`, { type: 'admin' })
      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('admin')
    })

    test('super user can assign owner role', async () => {
      if (!secondUserId) return

      const res = await put<SingleResponse>(`${basePath}/${secondUserId}`, { type: 'owner' })
      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('owner')
    })

    test('cleanup: remove role test member', async () => {
      if (!secondUserId) return

      // Downgrade from owner before deleting (backend blocks owner deletion)
      await put(`${basePath}/${secondUserId}`, { type: 'viewer' })
      await tryDelete(`${basePath}/${secondUserId}`)
      const idx = addedMemberUserIds.indexOf(secondUserId)
      if (idx !== -1) addedMemberUserIds.splice(idx, 1)
    })
  })

  // ── Section 8: Role Hierarchy Enforcement (admin API key) ──────────
  //
  // Uses an admin-scoped API key to verify that:
  // - Admins cannot assign roles equal to or higher than their own
  // - Admins cannot modify or remove members with equal or higher roles
  // - Admins CAN add/modify/remove members with lower roles

  describe('Role hierarchy enforcement', () => {
    // Dynamic target — discovered in global-setup from actual org members
    const memberUserId = ctx.targetMemberUserId || ''
    const adminOpts = () => ({ apiKey: ctx.adminApiKey! })
    const canRun = () => !!ctx.adminApiKey && !!ctx.targetMemberUserId

    test.skipIf(!canRun())('setup: ensure target is a project member', async () => {
      // Clean up any prior state, then add as viewer using super key
      await tryDelete(`${basePath}/${memberUserId}`)
      const res = await post<SingleResponse>(basePath, { userId: memberUserId, type: 'viewer' })
      expect(res.status).toBe(201)
      addedMemberUserIds.push(memberUserId)
    })

    // ── Cannot assign equal or higher roles ──

    test.skipIf(!canRun())('admin cannot assign owner role', async () => {
      const res = await put(`${basePath}/${memberUserId}`, { type: 'owner' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test.skipIf(!canRun())('admin cannot assign admin role (equal)', async () => {
      const res = await put(`${basePath}/${memberUserId}`, { type: 'admin' }, adminOpts())
      expect(res.status).toBe(403)
    })

    // ── Can assign lower roles ──

    test.skipIf(!canRun())('admin can assign member role', async () => {
      const res = await put<SingleResponse>(
        `${basePath}/${memberUserId}`, { type: 'member' }, adminOpts()
      )
      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('member')
    })

    test.skipIf(!canRun())('admin can update to viewer role', async () => {
      const res = await put<SingleResponse>(
        `${basePath}/${memberUserId}`, { type: 'viewer' }, adminOpts()
      )
      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('viewer')
    })

    // ── Cannot modify members with equal or higher roles ──

    test.skipIf(!canRun())('setup: super promotes member to admin', async () => {
      // Use super key to promote to admin role
      const res = await put<SingleResponse>(`${basePath}/${memberUserId}`, { type: 'admin' })
      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('admin')
    })

    test.skipIf(!canRun())('admin cannot modify equal-role member', async () => {
      // Target now has admin role — our admin user cannot change it
      const res = await put(`${basePath}/${memberUserId}`, { type: 'viewer' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test.skipIf(!canRun())('admin cannot remove equal-role member', async () => {
      const res = await del(`${basePath}/${memberUserId}`, adminOpts())
      expect(res.status).toBe(403)
    })

    // ── Cannot remove owners ──

    test.skipIf(!canRun())('setup: super promotes member to owner', async () => {
      const res = await put<SingleResponse>(`${basePath}/${memberUserId}`, { type: 'owner' })
      expect(res.status).toBe(200)
      expect(res.data.data.type).toBe('owner')
    })

    test.skipIf(!canRun())('admin cannot remove owner', async () => {
      const res = await del(`${basePath}/${memberUserId}`, adminOpts())
      expect(res.status).toBe(403)
    })

    // ── Can remove lower-role members ──

    test.skipIf(!canRun())('setup: super downgrades member to viewer', async () => {
      const res = await put<SingleResponse>(`${basePath}/${memberUserId}`, { type: 'viewer' })
      expect(res.status).toBe(200)
    })

    test.skipIf(!canRun())('admin can remove lower-role member', async () => {
      const res = await del(`${basePath}/${memberUserId}`, adminOpts())
      expect(res.status).toBe(200)
      // Remove from cleanup list
      const idx = addedMemberUserIds.indexOf(memberUserId)
      if (idx !== -1) addedMemberUserIds.splice(idx, 1)
    })

    // ── Cannot add member with equal or higher role ──

    test.skipIf(!canRun())('admin cannot add member with owner role', async () => {
      const res = await post(basePath, { userId: memberUserId, type: 'owner' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test.skipIf(!canRun())('admin cannot add member with admin role', async () => {
      const res = await post(basePath, { userId: memberUserId, type: 'admin' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test.skipIf(!canRun())('admin can add member with viewer role', async () => {
      const res = await post<SingleResponse>(
        basePath, { userId: memberUserId, type: 'viewer' }, adminOpts()
      )
      expect(res.status).toBe(201)
      expect(res.data.data.type).toBe('viewer')
      addedMemberUserIds.push(memberUserId)
    })

    test.skipIf(!canRun())('cleanup: remove hierarchy test member', async () => {
      await tryDelete(`${basePath}/${memberUserId}`)
      const idx = addedMemberUserIds.indexOf(memberUserId)
      if (idx !== -1) addedMemberUserIds.splice(idx, 1)
    })
  })
})
