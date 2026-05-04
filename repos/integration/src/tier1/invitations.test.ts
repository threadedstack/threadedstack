import { describe, test, expect, afterAll } from 'vitest'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'

/**
 * Tier 1: Invitations CRUD
 *
 * Tests the invitation workflow endpoints:
 * - POST /orgs/:orgId/users/invite  (create invitation)
 * - GET  /invitations/me            (pending invitations for current user)
 * - GET  /invitations/org/:orgId    (list org invitations — admin+)
 * - DELETE /invitations/:id         (revoke pending invitation)
 * - POST /invitations/accept        (accept — limited testability with API keys)
 *
 * Note: The /invitations/me and /invitations/accept endpoints require a
 * real JWT-authenticated user (req.user with email). API key auth does not
 * populate req.user.email the same way, so those endpoints may return 401.
 * Tests are written to handle both outcomes gracefully.
 */
describe('Tier 1: Invitations', () => {
  const ctx = readContext()

  /** IDs of invitations created during tests — cleaned up in afterAll */
  const createdInvitationIds: string[] = []

  /** Whether the org's plan allows invitations (Pro/Team tier) */
  let canInvite = false

  /** ID of the invitation created by the invite test — used by revoke/list tests */
  let invitationId = ''

  afterAll(async () => {
    for (const id of createdInvitationIds) {
      await tryDelete(`/invitations/${id}`)
    }
  })

  // ── Invite (POST /orgs/:orgId/users/invite) ────────────────────────

  describe('POST /orgs/:orgId/users/invite', () => {
    test('determines if org plan allows invitations', async () => {
      const limitsRes = await get<{ seats: number; additionalSeats: boolean }>(
        `/orgs/${ctx.orgId}/quotas/limits`
      )

      expect(limitsRes.status).toBe(200)
      expect(limitsRes.data).toBeDefined()

      // Free/Solo tiers block invitations (additionalSeats=false, seats=1).
      // Pro/Team tiers allow them. Store for downstream tests.
      canInvite = !!limitsRes.data.additionalSeats
    })

    test('invite with valid email + roleType creates invitation', async () => {
      if (!canInvite) {
        console.warn('[invitations] SKIPPED: invite test — org plan does not allow invitations')
        return
      }

      const email = `inv-test-${Date.now()}@integration-test.example.com`
      const res = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/users/invite`,
        { email, roleType: 'member' }
      )

      expect(res.status).toBe(201)
      expect(res.data).toBeDefined()
      expect(res.message).toBeDefined()

      // The response data is either an invitation object (new user) or a role
      // object (existing user added directly). Both have an `id` field.
      if (res.data.id) {
        invitationId = res.data.id
        createdInvitationIds.push(invitationId)
      }
    })

    test('returns 400 when email is missing', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/users/invite`,
        { roleType: 'member' }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 when roleType is missing', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/users/invite`,
        { email: 'missing-role@integration-test.example.com' }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 400 for invalid roleType', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/users/invite`,
        {
          email: 'bad-role@integration-test.example.com',
          roleType: 'superadmin_invalid',
        }
      )

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 401 without auth', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/users/invite`,
        { email: 'noauth@integration-test.example.com', roleType: 'member' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })

    test('returns 403 on free/solo tier (no additional seats)', async () => {
      if (canInvite) {
        console.warn('[invitations] SKIPPED: free-tier test — org allows invitations (pro/team tier)')
        return
      }

      const res = await post(
        `/orgs/${ctx.orgId}/users/invite`,
        {
          email: `free-tier-${Date.now()}@integration-test.example.com`,
          roleType: 'member',
        }
      )

      expect(res.status).toBe(403)
      expect(res.ok).toBe(false)
    })
  })

  // ── List org invitations (GET /invitations/org/:orgId) ─────────────

  describe('GET /invitations/org/:orgId', () => {
    test('lists org invitations with 200', async () => {
      const res = await get<any[]>(`/invitations/org/${ctx.orgId}`)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
      expect(typeof res.limit).toBe('number')
      expect(typeof res.offset).toBe('number')
    })

    test('includes created invitation in org list', async () => {
      if (!invitationId) {
        console.warn('[invitations] SKIPPED: list test — no invitation was created')
        return
      }

      const res = await get<any[]>(`/invitations/org/${ctx.orgId}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      const found = res.data.find((inv: any) => inv.id === invitationId)
      expect(found).toBeDefined()
      expect(found?.status).toBe('pending')
    })

    test('supports status=all query filter', async () => {
      const res = await get<any[]>(
        `/invitations/org/${ctx.orgId}?status=all`
      )

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      expect(Array.isArray(res.data)).toBe(true)
    })

    test('returns 401 without auth', async () => {
      const res = await get(
        `/invitations/org/${ctx.orgId}`,
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ── Pending invitations (GET /invitations/me) ──────────────────────

  describe('GET /invitations/me', () => {
    test('returns 200 or 401 for API-key auth', async () => {
      // /invitations/me requires req.user.email which may not be populated
      // for API key auth. Accept either a successful response or 401.
      const res = await get<any[]>('/invitations/me')

      if (res.status === 200) {
        expect(res.ok).toBe(true)
        expect(Array.isArray(res.data)).toBe(true)
      } else {
        // API key auth may not provide a user email — 401
        expect(res.status).toBe(401)
        expect(res.ok).toBe(false)
      }
    })

    test('returns 401 without auth', async () => {
      const res = await get('/invitations/me', { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ── Revoke invitation (DELETE /invitations/:id) ────────────────────

  describe('DELETE /invitations/:invitationId', () => {
    test('revoke a pending invitation returns 200', async () => {
      if (!invitationId) {
        console.warn('[invitations] SKIPPED: revoke test — no invitation was created')
        return
      }

      const res = await del<{ success: boolean }>(`/invitations/${invitationId}`)

      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
      // Remove from cleanup list since it's already revoked
      const idx = createdInvitationIds.indexOf(invitationId)
      if (idx !== -1) createdInvitationIds.splice(idx, 1)

      // Clear so downstream tests know it's been revoked
      invitationId = ''
    })

    test('returns 404 for nonexistent invitation ID', async () => {
      const fakeId = 'zz99Xfake2'
      const res = await del(`/invitations/${fakeId}`)

      expect(res.status).toBe(404)
      expect(res.ok).toBe(false)
    })

    test('returns 401 without auth', async () => {
      const res = await del('/invitations/some-id', { noAuth: true })

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })

  // ── Accept invitation (POST /invitations/accept) ──────────────────

  describe('POST /invitations/accept', () => {
    test('returns 400 when token is missing', async () => {
      const res = await post('/invitations/accept', {})

      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    })

    test('returns 404 for invalid token', async () => {
      // Accept requires a logged-in user (req.user) — with API key auth
      // this may return 401 instead of 404.
      const res = await post('/invitations/accept', { token: 'invalid-token-does-not-exist' })

      expect([401, 404]).toContain(res.status)
      expect(res.ok).toBe(false)
    })

    test('returns 401 without auth', async () => {
      const res = await post(
        '/invitations/accept',
        { token: 'no-auth-token' },
        { noAuth: true }
      )

      expect(res.status).toBe(401)
      expect(res.ok).toBe(false)
    })
  })
})
