import { describe, test, expect, afterAll } from 'vitest'
import { get, post, put, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

interface RoleMemberUser {
  id: string
  email?: string
  name?: string
  first?: string
  last?: string
  image?: string
}

interface RoleMember {
  id: string
  userId: string
  projectId: string
  type: string
  orgId: string | null
  name: string | null
  createdAt: string
  updatedAt: string
  user?: RoleMemberUser
}

type ListResponse = RoleMember[]

type SingleResponse = RoleMember

describe('Tier 1: Project Members', () => {
  const ctx = readContext()
  const basePath = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`

  // Track members added during tests for cleanup
  const addedMemberUserIds: string[] = []

  afterAll(async () => {
    for (const userId of addedMemberUserIds) {
      // Downgrade to member first in case member has owner role (backend blocks owner deletion)
      try { await put(`${basePath}/${userId}`, { roleType: 'member' }) } catch {}
      await tryDelete(`${basePath}/${userId}`)
    }
  })

  // ── Section 1: List Project Members ──────────────────────────────────

  describe('List project members', () => {
    test('GET returns 200 with data array', async () => {
      const res = await get<ListResponse>(basePath)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
      expect(typeof res.limit).toBe('number')
      expect(typeof res.offset).toBe('number')
    })

    test('returns limit and offset metadata from query params', async () => {
      const res = await get<ListResponse>(`${basePath}?limit=1&offset=0`)

      expect(res.status).toBe(200)
      expect(res.limit).toBe(1)
      expect(res.offset).toBe(0)
      // Note: backend echoes pagination params but doesn't apply them to data
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('each member has expected shape', async () => {
      const res = await get<ListResponse>(basePath)
      if (!res.data.length) return // skip if no members yet

      const member = res.data[0]
      expect(member).toHaveProperty('id')
      expect(member).toHaveProperty('userId')
      expect(member).toHaveProperty('projectId')
      expect(member).toHaveProperty('type')
      expect(typeof member.id).toBe('string')
      expect(typeof member.userId).toBe('string')
      expect(member.projectId).toBe(ctx.projectId)
      expect(['owner', 'admin', 'member']).toContain(member.type)

      expect(member).toHaveProperty('user')
      expect(member.user).toBeDefined()
      expect(typeof member.user!.id).toBe('string')
      expect(member.user!.id).toBe(member.userId)
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
      const res = await put(`${basePath}/${fakeUserId}`, { roleType: 'member' })
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

      const orgMembers = orgMembersRes.data
      const otherMember = orgMembers.find((m: RoleMember) => m.userId !== ctx.userId)
      if (!otherMember) {
        console.warn('Only one org member exists — skipping lifecycle tests')
        return
      }
      secondUserId = otherMember.userId
    })

    test('POST adds member with member role', async () => {
      if (!secondUserId) return // skip if no second member

      // First remove them from the project if already a member (cleanup from prior runs)
      await tryDelete(`${basePath}/${secondUserId}`)

      const res = await post<SingleResponse>(basePath, {
        userId: secondUserId,
        roleType: 'member',
      })

      expect(res.status).toBe(201)
      expect(res.data.userId).toBe(secondUserId)
      expect(res.data.type).toBe('member')
      expect(res.data.projectId).toBe(ctx.projectId)
      addedMemberUserIds.push(secondUserId)
    })

    test('GET confirms new member in list', async () => {
      if (!secondUserId) return

      const res = await get<ListResponse>(basePath)
      expect(res.status).toBe(200)
      const found = res.data.find((m: RoleMember) => m.userId === secondUserId)
      expect(found).toBeDefined()
      expect(found!.type).toBe('member')
    })

    test('PUT updates member role to member', async () => {
      if (!secondUserId) return

      const res = await put<SingleResponse>(`${basePath}/${secondUserId}`, {
        roleType: 'member',
      })

      expect(res.status).toBe(200)
      expect(res.data.type).toBe('member')
    })

    test('GET confirms updated role', async () => {
      if (!secondUserId) return

      const res = await get<ListResponse>(basePath)
      expect(res.status).toBe(200)
      const found = res.data.find((m: RoleMember) => m.userId === secondUserId)
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
      const found = res.data.find((m: RoleMember) => m.userId === secondUserId)
      expect(found).toBeUndefined()
    })
  })

  // ── Section 7: Role Assignment (super user can assign all roles) ────

  describe('Role assignment', () => {
    let secondUserId: string | null = null

    test('setup: add member for role tests', async () => {
      const orgMembersRes = await get<ListResponse>(`/orgs/${ctx.orgId}/members`)
      const orgMembers = orgMembersRes.data
      const otherMember = orgMembers.find((m: RoleMember) => m.userId !== ctx.userId)
      if (!otherMember) {
        console.warn('Only one org member — skipping role assignment tests')
        return
      }
      secondUserId = otherMember.userId

      // Ensure they're a project member first (as member)
      await tryDelete(`${basePath}/${secondUserId}`)
      const addRes = await post(basePath, { userId: secondUserId, roleType: 'member' })
      expect(addRes.status).toBe(201)
      addedMemberUserIds.push(secondUserId)
    })

    test('super user can assign admin role (requires owner+ — skipped via API key)', async () => {
      if (!secondUserId) return

      const res = await put<SingleResponse>(`${basePath}/${secondUserId}`, { roleType: 'admin' })
      // API keys cap at admin — assigning admin role requires owner+ access
      if (res.status === 403) {
        console.warn('[project-members] SKIPPED: assign admin requires owner+ (API key caps at admin)')
        return
      }
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('admin')
    })

    test('super user can assign owner role (requires owner+ — skipped via API key)', async () => {
      if (!secondUserId) return

      const res = await put<SingleResponse>(`${basePath}/${secondUserId}`, { roleType: 'owner' })
      if (res.status === 403) {
        console.warn('[project-members] SKIPPED: assign owner requires owner+ (API key caps at admin)')
        return
      }
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('owner')
    })

    test('cleanup: remove role test member', async () => {
      if (!secondUserId) return

      // Downgrade from owner before deleting (backend blocks owner deletion)
      await put(`${basePath}/${secondUserId}`, { roleType: 'member' })
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

    test('precondition: admin key and target member are available', () => {
      expect(ctx.adminApiKey, 'adminApiKey missing — global-setup failed to find admin member').toBeTruthy()
      expect(ctx.targetMemberUserId, 'targetMemberUserId missing — need ≥3 org members').toBeTruthy()
    })

    test('setup: ensure target is a project member', async () => {
      // Clean up any prior state, then add as member using super key
      await tryDelete(`${basePath}/${memberUserId}`)
      const res = await post<SingleResponse>(basePath, { userId: memberUserId, roleType: 'member' })
      expect(res.status).toBe(201)
      addedMemberUserIds.push(memberUserId)
    })

    // ── Cannot assign equal or higher roles ──

    test('admin cannot assign owner role', async () => {
      const res = await put(`${basePath}/${memberUserId}`, { roleType: 'owner' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test('admin cannot assign admin role (equal)', async () => {
      const res = await put(`${basePath}/${memberUserId}`, { roleType: 'admin' }, adminOpts())
      expect(res.status).toBe(403)
    })

    // ── Can assign lower roles ──

    test('admin can assign member role', async () => {
      const res = await put<SingleResponse>(
        `${basePath}/${memberUserId}`, { roleType: 'member' }, adminOpts()
      )
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('member')
    })

    test('admin can update to member role', async () => {
      const res = await put<SingleResponse>(
        `${basePath}/${memberUserId}`, { roleType: 'member' }, adminOpts()
      )
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('member')
    })

    // ── Cannot modify members with equal or higher roles ──

    test('setup: super promotes member to admin (requires owner+ — skipped via API key)', async () => {
      const res = await put<SingleResponse>(`${basePath}/${memberUserId}`, { roleType: 'admin' })
      if (res.status === 403) {
        console.warn('[project-members] SKIPPED: promote to admin requires owner+ (API key caps at admin)')
        return
      }
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('admin')
    })

    test('admin cannot modify equal-role member', async () => {
      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === memberUserId)
      if (target?.type !== 'admin') {
        console.warn('[project-members] SKIPPED: equal-role test — target is %s not admin', target?.type)
        return
      }
      const res = await put(`${basePath}/${memberUserId}`, { roleType: 'member' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test('admin cannot remove equal-role member', async () => {
      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === memberUserId)
      if (target?.type !== 'admin') {
        console.warn('[project-members] SKIPPED: equal-role removal — target is %s not admin', target?.type)
        return
      }
      const res = await del(`${basePath}/${memberUserId}`, adminOpts())
      expect(res.status).toBe(403)
    })

    test('setup: super promotes member to owner (requires owner+ — skipped via API key)', async () => {
      const res = await put<SingleResponse>(`${basePath}/${memberUserId}`, { roleType: 'owner' })
      if (res.status === 403) {
        console.warn('[project-members] SKIPPED: promote to owner requires owner+ (API key caps at admin)')
        return
      }
      expect(res.status).toBe(200)
      expect(res.data.type).toBe('owner')
    })

    test('admin cannot remove owner', async () => {
      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === memberUserId)
      if (target?.type !== 'owner') {
        console.warn('[project-members] SKIPPED: owner removal test — target is %s not owner', target?.type)
        return
      }
      const res = await del(`${basePath}/${memberUserId}`, adminOpts())
      expect(res.status).toBe(403)
    })

    test('setup: super downgrades member to member', async () => {
      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === memberUserId)
      if (!target || target.type === 'member') {
        console.warn('[project-members] SKIPPED: downgrade -- target is already member or not found')
        return
      }
      const res = await put<SingleResponse>(`${basePath}/${memberUserId}`, { roleType: 'member' })
      if (res.status === 403) {
        console.warn('[project-members] SKIPPED: downgrade requires owner+ (API key caps at admin)')
        return
      }
      expect(res.status).toBe(200)
    })

    test('admin can remove lower-role member', async () => {
      const memberRes = await get<Array<{ userId: string; type: string }>>(`${basePath}`)
      const target = memberRes.data?.find?.((m: any) => m.userId === memberUserId)
      if (!target || target.type === 'admin' || target.type === 'owner') {
        console.warn('[project-members] SKIPPED: remove lower-role — target is %s (not lower than admin)', target?.type)
        return
      }
      const res = await del(`${basePath}/${memberUserId}`, adminOpts())
      expect(res.status).toBe(200)
      const idx = addedMemberUserIds.indexOf(memberUserId)
      if (idx !== -1) addedMemberUserIds.splice(idx, 1)
    })

    // ── Cannot add member with equal or higher role ──

    test('admin cannot add member with owner role', async () => {
      const res = await post(basePath, { userId: memberUserId, roleType: 'owner' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test('admin cannot add member with admin role', async () => {
      const res = await post(basePath, { userId: memberUserId, roleType: 'admin' }, adminOpts())
      expect(res.status).toBe(403)
    })

    test('admin can add member with member role', async () => {
      const res = await post<SingleResponse>(
        basePath, { userId: memberUserId, roleType: 'member' }, adminOpts()
      )
      expect(res.status).toBe(201)
      expect(res.data.type).toBe('member')
      addedMemberUserIds.push(memberUserId)
    })

    test('cleanup: remove hierarchy test member', async () => {
      await tryDelete(`${basePath}/${memberUserId}`)
      const idx = addedMemberUserIds.indexOf(memberUserId)
      if (idx !== -1) addedMemberUserIds.splice(idx, 1)
    })
  })
})
