import { describe, test, expect } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 3: Seat Management
 *
 * Tests that invitation/member operations respect the plan's seat limits.
 * Free/Solo tiers have seats=1 and additionalSeats=false, so invitations
 * should be rejected with 403. Pro/Team tiers allow additional seats.
 */
describe('Tier 3: Seat Management', () => {
  const ctx = readContext()

  test('determines org tier and verifies seat limits', async () => {
    // Get the org's plan limits to determine which tier we're testing against
    const limitsRes = await get<{ seats: number; additionalSeats: boolean }>(
      `/orgs/${ctx.orgId}/quotas/limits`
    )

    expect(limitsRes.status).toBe(200)
    expect(limitsRes.data).toBeDefined()

    const { seats, additionalSeats } = limitsRes.data
    expect(typeof seats).toBe('number')
    expect(typeof additionalSeats).toBe('boolean')

    // Verify limits are consistent with known tier configurations:
    // free: seats=1, additionalSeats=false
    // solo: seats=1, additionalSeats=false
    // pro:  seats=3, additionalSeats=true
    // team: seats=10, additionalSeats=true
    if (!additionalSeats) {
      expect(seats).toBe(1)
    } else {
      expect(seats).toBeGreaterThanOrEqual(3)
    }
  })

  test('invite to free/solo org is rejected with 403', async () => {
    const limitsRes = await get<{ seats: number; additionalSeats: boolean }>(
      `/orgs/${ctx.orgId}/quotas/limits`
    )

    if (limitsRes.data?.additionalSeats) {
      // This org is on a Pro/Team plan — skip this test
      return
    }

    // Free or Solo tier — invitations should be blocked
    const inviteRes = await post(
      `/orgs/${ctx.orgId}/users/invite`,
      {
        email: 'seat-test-nonexistent@integration.test',
        roleType: 'member',
      }
    )

    expect(inviteRes.status).toBe(403)
  })

  test('invite with valid email format is accepted on Pro/Team tier', async () => {
    const limitsRes = await get<{ seats: number; additionalSeats: boolean }>(
      `/orgs/${ctx.orgId}/quotas/limits`
    )

    if (!limitsRes.data?.additionalSeats) {
      // This org is on a Free/Solo plan — skip this test
      return
    }

    // Pro/Team tier — check if seats are available
    const membersRes = await get<Array<{ userId: string }>>(
      `/orgs/${ctx.orgId}/members`
    )

    const currentMembers = membersRes.data?.length || 0
    const seatLimit = limitsRes.data.seats

    // Only test invitation if there's room (-1 means unlimited)
    if (seatLimit !== -1 && currentMembers >= seatLimit) {
      return
    }

    // Attempt invitation — should be accepted (201)
    // Using a non-existent email to avoid side effects
    const inviteRes = await post<Record<string, unknown>>(
      `/orgs/${ctx.orgId}/users/invite`,
      {
        email: `seat-test-${Date.now()}@integration.test`,
        roleType: 'member',
      }
    )

    // Should succeed — 201 for invitation created
    expect(inviteRes.status).toBe(201)
    expect(inviteRes.message).toBeDefined()
  })

  test('invite requires valid roleType', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/users/invite`,
      {
        email: 'test@integration.test',
        roleType: 'invalid_role_type',
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('invite requires email field', async () => {
    const res = await post(
      `/orgs/${ctx.orgId}/users/invite`,
      {
        roleType: 'member',
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})
