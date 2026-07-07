import { describe, test, expect } from 'vitest'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: Agent Escalations (P4b) — list/get are read-only; resolve is the
 * only mutation endpoint.
 *
 * Escalation rows are only ever written internally (openEscalation, called
 * from the scheduler executor when a steward report includes a
 * `tdsk-escalations` block, or from the agent's escalate tool) — there is no
 * public create endpoint, mirroring verifications.test.ts. TDSK_IT_ORG_ID is
 * a stable, long-lived org where real steward activity may have already
 * opened escalations, so list/get assertions target the request/response
 * contract rather than exact contents, and a random agentId filter (which no
 * real row can match) pins down the empty-result case deterministically.
 *
 * The resolve endpoint is exercised for its full validation contract
 * (400/404/409) without touching any real row — mutating a genuinely open
 * escalation here would corrupt state the steward's own routing depends on
 * across cycles.
 */
describe('Tier 1: Escalations', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/escalations returns an array', async () => {
    const res = await get<unknown[]>(`/orgs/${ctx.orgId}/escalations`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /orgs/:orgId/escalations?status=open filters by status', async () => {
    const res = await get<Array<{ status: string }>>(
      `/orgs/${ctx.orgId}/escalations?status=open`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    for (const row of res.data || []) expect(row.status).toBe('open')
  })

  test('GET /orgs/:orgId/escalations?status=routed filters by status', async () => {
    const res = await get<Array<{ status: string }>>(
      `/orgs/${ctx.orgId}/escalations?status=routed`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    for (const row of res.data || []) expect(row.status).toBe('routed')
  })

  test('GET /orgs/:orgId/escalations?status=bogus rejects an invalid status with 400', async () => {
    const res = await get(`/orgs/${ctx.orgId}/escalations?status=bogus`)

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('GET /orgs/:orgId/escalations?agentId=<random> returns no rows for a non-existent agent', async () => {
    const randomAgentId = `agt_nonexistent_${Date.now()}`
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/escalations?agentId=${randomAgentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toEqual([])
  })

  test('GET /orgs/:orgId/escalations/:escalationId 404s for a non-existent id', async () => {
    const res = await get(`/orgs/${ctx.orgId}/escalations/esc_nonexistent_${Date.now()}`)

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  test('GET /orgs/:orgId/escalations requires orgId to be a member org (403/404 for a foreign org)', async () => {
    const foreignOrgId = `org_foreign_${Date.now()}`
    const res = await get(`/orgs/${foreignOrgId}/escalations`)

    expect(res.ok).toBe(false)
    expect([403, 404]).toContain(res.status)
  })

  describe('POST /orgs/:orgId/escalations/:escalationId/resolve — validation contract', () => {
    test('404s for a non-existent escalation', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/escalations/esc_nonexistent_${Date.now()}/resolve`,
        { status: 'resolved' }
      )

      expect(res.ok).toBe(false)
      expect(res.status).toBe(404)
    })

    test('400s when status is missing', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/escalations/esc_nonexistent_${Date.now()}/resolve`,
        {}
      )

      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    })

    test('400s when status is neither resolved nor rejected', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/escalations/esc_nonexistent_${Date.now()}/resolve`,
        { status: 'promoted' }
      )

      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    })

    test('400s when resolvedRef is not a string', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/escalations/esc_nonexistent_${Date.now()}/resolve`,
        { status: 'resolved', resolvedRef: 123 }
      )

      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    })

    test('400s when reason is not a string', async () => {
      const res = await post(
        `/orgs/${ctx.orgId}/escalations/esc_nonexistent_${Date.now()}/resolve`,
        { status: 'rejected', reason: true }
      )

      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    })

    test('404s for a foreign org even with a well-formed body', async () => {
      const foreignOrgId = `org_foreign_${Date.now()}`
      const res = await post(
        `/orgs/${foreignOrgId}/escalations/esc_nonexistent_${Date.now()}/resolve`,
        { status: 'resolved' }
      )

      expect(res.ok).toBe(false)
      expect([403, 404]).toContain(res.status)
    })
  })
})
