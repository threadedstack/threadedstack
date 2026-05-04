import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import {
  inviteUser,
  revokeInvitation,
  listOrgInvitations,
} from '../utils/invitation-helpers'

/**
 * Tier 3: Invitation Lifecycle
 *
 * End-to-end tests for the full invitation workflow:
 * invite -> list -> revoke -> verify removal, duplicate handling, validation.
 *
 * Note: The accept flow requires JWT auth (real user with matching email),
 * which is not available in API-key-based integration tests. We test
 * everything up to that point.
 */
describe('Tier 3: Invitation Lifecycle', () => {
  const ctx = readContext()

  /** Track invitation IDs created during this suite for cleanup */
  const createdInvitationIds: string[] = []

  /** Whether the org tier allows invitations (Pro/Team only) */
  let canInvite = false

  beforeAll(async () => {
    // Determine whether the org's plan tier permits invitations.
    // Free/Solo tiers have seats=1 and additionalSeats=false — invites are blocked with 403.
    const limitsRes = await get<{ seats: number; additionalSeats: boolean }>(
      `/orgs/${ctx.orgId}/quotas/limits`
    )

    expect(limitsRes.status).toBe(200)

    if (limitsRes.data?.additionalSeats) {
      canInvite = true
    } else {
      console.warn(
        '[invitation-lifecycle] beforeAll: canInvite=false — additionalSeats=%s',
        limitsRes.data?.additionalSeats
      )
    }
  })

  afterAll(async () => {
    // Best-effort cleanup: revoke any pending invitations we created
    for (const id of createdInvitationIds) {
      try {
        await revokeInvitation(id)
      } catch (err: any) {
        console.warn('[invitation-lifecycle] afterAll: failed to revoke invitation %s —', id, err?.message || err)
      }
    }
  })

  test('invite user by email creates a pending invitation', async () => {
    if (!canInvite) {
      console.warn('[invitation-lifecycle] SKIPPED: invite user by email — org plan does not allow invitations')
      return
    }

    const email = `test-invite-${Date.now()}@integration-test.example.com`
    const res = await inviteUser(ctx.orgId, email, 'member')

    expect(res.status).toBe(201)
    expect(res.data).toBeDefined()

    // Track for cleanup
    if (res.data?.id) {
      createdInvitationIds.push(res.data.id)
    }

    // Verify response contains invitation data
    expect(res.message).toBeDefined()
  })

  test('list org invitations shows the newly created invitation', async () => {
    if (!canInvite) {
      console.warn('[invitation-lifecycle] SKIPPED: list org invitations — org plan does not allow invitations')
      return
    }

    // Create a fresh invitation so we know exactly what to look for
    const email = `test-list-${Date.now()}@integration-test.example.com`
    const createRes = await inviteUser(ctx.orgId, email, 'member')
    expect(createRes.status).toBe(201)

    const invitationId = createRes.data?.id
    if (invitationId) {
      createdInvitationIds.push(invitationId)
    }

    // List pending invitations for the org
    const listRes = await listOrgInvitations(ctx.orgId)

    expect(listRes.status).toBe(200)
    expect(listRes.data).toBeDefined()
    expect(Array.isArray(listRes.data)).toBe(true)

    // The invitation we just created should appear in the list
    if (invitationId) {
      const found = listRes.data.find((inv: any) => inv.id === invitationId)
      expect(found).toBeDefined()
      expect(found.email).toBe(email)
      expect(found.status).toBe('pending')
    }
  })

  test('revoke invitation returns 200 and removes it from pending list', async () => {
    if (!canInvite) {
      console.warn('[invitation-lifecycle] SKIPPED: revoke invitation — org plan does not allow invitations')
      return
    }

    // Create an invitation to revoke
    const email = `test-revoke-${Date.now()}@integration-test.example.com`
    const createRes = await inviteUser(ctx.orgId, email, 'member')
    expect(createRes.status).toBe(201)

    const invitationId = createRes.data?.id
    expect(invitationId).toBeTruthy()

    // Revoke it
    const revokeRes = await revokeInvitation(invitationId)
    expect(revokeRes.status).toBe(200)

    // No need to track for cleanup — it's already revoked

    // Verify it no longer appears in the pending list
    const listRes = await listOrgInvitations(ctx.orgId)
    expect(listRes.status).toBe(200)

    if (Array.isArray(listRes.data)) {
      const found = listRes.data.find((inv: any) => inv.id === invitationId)
      // Should either be absent or have a non-pending status
      if (found) {
        expect(found.status).not.toBe('pending')
      }
    }
  })

  test('duplicate invitation for same email is rejected while pending', async () => {
    if (!canInvite) {
      console.warn('[invitation-lifecycle] SKIPPED: duplicate invitation — org plan does not allow invitations')
      return
    }

    const email = `test-dup-${Date.now()}@integration-test.example.com`

    // First invitation
    const first = await inviteUser(ctx.orgId, email, 'member')
    expect(first.status).toBe(201)
    if (first.data?.id) {
      createdInvitationIds.push(first.data.id)
    }

    // Second invitation with the same email — should be rejected
    // because a pending invitation already exists (InviteService.invited() throws 400)
    const second = await inviteUser(ctx.orgId, email, 'member')

    expect(second.ok).toBe(false)
    expect(second.status).toBe(400)
  })

  test('invite with invalid roleType returns 400', async () => {
    const email = `test-role-${Date.now()}@integration-test.example.com`
    const res = await post(
      `/orgs/${ctx.orgId}/users/invite`,
      { email, roleType: 'superadmin_fake' }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('invite with missing email returns 400', async () => {
    // This test does not depend on canInvite — validation happens before seat checks
    const res = await post(
      `/orgs/${ctx.orgId}/users/invite`,
      { roleType: 'member' }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('revoke non-existent invitation returns 404', async () => {
    const fakeId = 'zz99Xfake3'
    const res = await revokeInvitation(fakeId)

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })
})
