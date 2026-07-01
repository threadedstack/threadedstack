import { describe, test, expect, afterAll } from 'vitest'
import { isFeatureEnabled } from '@tdsk/domain'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

/**
 * Member-role permission boundary tests.
 *
 * Verifies that member-role users have correct read access and are denied
 * write/manage operations that require admin+ or owner privileges.
 *
 * Complements role-permission-matrix.test.ts which covers owner and admin
 * roles but explicitly excludes member-scoped tests.
 *
 * Requires ctx.memberApiKey provisioned in global-setup. If unavailable,
 * all tests are skipped.
 */

const ctx = readContext()
const hasMember = !!ctx.memberApiKey

/** Send request as the member user instead of the default owner */
const memberOpts = () => ({ apiKey: ctx.memberApiKey! })

/** A non-existent UUID for delete tests — auth should be checked before existence */
const nonexistentId = '00000000-0000-0000-0000-000000000000'

describe.skipIf(!hasMember)('Tier 1: Member Permission Boundaries', () => {
  const accidentalResourceIds: string[] = []

  afterAll(async () => {
    for (const id of accidentalResourceIds) {
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${id}`)
      await tryDelete(`/orgs/${ctx.orgId}/api-keys/${id}`)
    }
  })

  // ── Section 1: Member CAN read (200) ──────────────────────────────

  describe('Member read access (allowed)', () => {
    test('member can read the org', async () => {
      const res = await get<{ id: string }>(`/orgs/${ctx.orgId}`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(res.data.id).toBe(ctx.orgId)
    })

    test('member can list projects', async () => {
      const res = await get(`/orgs/${ctx.orgId}/projects`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test.skipIf(!isFeatureEnabled('agents'))('member can list agents', async () => {
      const res = await get(`/orgs/${ctx.orgId}/agents`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('member can list sandboxes', async () => {
      const res = await get(`/orgs/${ctx.orgId}/sandboxes`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('member can list providers', async () => {
      const res = await get(`/orgs/${ctx.orgId}/providers`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('member can list org members', async () => {
      const res = await get(`/orgs/${ctx.orgId}/members`, memberOpts())
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })
  })

  // ── Section 2: Member CANNOT write/manage (403) ───────────────────

  describe('Member write/manage operations (denied)', () => {
    test('member cannot create secrets', async () => {
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/secrets`,
        { name: 'member-perm-test', value: 'should-be-denied' },
        memberOpts()
      )
      if (res.data?.id) accidentalResourceIds.push(res.data.id)
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot delete the org', async () => {
      // Use nonexistent org — NEVER send DELETE for the real org
      const res = await del(`/orgs/${nonexistentId}`, memberOpts())
      expect([403, 404]).toContain(res.status)
      expect(res.ok).toBe(false)
    })

    test('member cannot invite users', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/users/invite`,
        { email: 'member-perm-test@example.com', roleType: 'member' },
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot create API keys for another user', async () => {
      // Members CAN create keys for themselves (apiKey:create is in the member
      // role template). Cross-user creation requires apiKey:manage (admin+),
      // so target another user here to verify that boundary.
      const otherUserId = ctx.adminUserId || ctx.userId
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/api-keys`,
        { name: 'member-perm-test-key', userId: otherUserId },
        memberOpts()
      )
      if (res.data?.id) accidentalResourceIds.push(res.data.id)
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot delete sandboxes', async () => {
      // Use a nonexistent UUID — RBAC check should happen before existence check
      const res = await del(
        `/orgs/${ctx.orgId}/sandboxes/${nonexistentId}`,
        memberOpts()
      )
      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })

    test('member cannot remove org members', async () => {
      // Use nonexistent ID — NEVER send DELETE for real members
      const res = await del(
        `/orgs/${ctx.orgId}/members/${nonexistentId}`,
        memberOpts()
      )
      expect([403, 404]).toContain(res.status)
      expect(res.ok).toBe(false)
    })
  })
})
