import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 1: Post-merge Verifications (P4c) — read-only observability surface.
 *
 * Rows are only ever written internally by the scheduler executor
 * (`db.services.verification.upsertByPr`, repos/backend/src/services/scheduler/executor.ts)
 * when a steward agent's report includes a `tdsk-verify-results` block — there is no
 * create endpoint. TDSK_IT_ORG_ID is a stable, long-lived org (real steward activity may
 * already have written rows into it), so these tests assert the request/response
 * contract rather than exact list contents, and use a random agentId filter — which no
 * real row can match — to pin down the empty-result case deterministically.
 */
describe('Tier 1: Verifications (read-only)', () => {
  const ctx = readContext()

  test('GET /orgs/:orgId/verifications returns an array', async () => {
    const res = await get<unknown[]>(`/orgs/${ctx.orgId}/verifications`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /orgs/:orgId/verifications?status=pending filters by status', async () => {
    const res = await get<Array<{ status: string }>>(
      `/orgs/${ctx.orgId}/verifications?status=pending`
    )

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    for (const row of res.data || []) expect(row.status).toBe('pending')
  })

  test('GET /orgs/:orgId/verifications?status=bogus rejects an invalid status with 400', async () => {
    const res = await get(`/orgs/${ctx.orgId}/verifications?status=bogus`)

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('GET /orgs/:orgId/verifications?agentId=<random> returns no rows for a non-existent agent', async () => {
    const randomAgentId = `agt_nonexistent_${Date.now()}`
    const res = await get<unknown[]>(
      `/orgs/${ctx.orgId}/verifications?agentId=${randomAgentId}`
    )

    expect(res.status).toBe(200)
    expect(res.data).toEqual([])
  })

  test('GET /orgs/:orgId/verifications/:verificationId 404s for a non-existent id', async () => {
    const res = await get(`/orgs/${ctx.orgId}/verifications/vf_nonexistent_${Date.now()}`)

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  test('GET /orgs/:orgId/verifications requires orgId to be a member org (403/404 for a foreign org)', async () => {
    const foreignOrgId = `org_foreign_${Date.now()}`
    const res = await get(`/orgs/${foreignOrgId}/verifications`)

    expect(res.ok).toBe(false)
    expect([403, 404]).toContain(res.status)
  })
})
