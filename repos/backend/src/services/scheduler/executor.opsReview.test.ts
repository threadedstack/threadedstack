import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EOpsActionStatus, OpsReviewsBlockFence, OpsReviewInjectMax } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the helper functions never pulls in the heavy agent runtime.
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

// Stub escalation, task, and skill promotion so executor can be imported cleanly.
vi.mock(`@TBE/utils/agent/escalationPromotion`, () => ({
  openEscalation: vi.fn(),
  resolveEscalation: vi.fn(),
}))
vi.mock(`@TBE/utils/agent/taskPromotion`, () => ({
  authorTaskProposal: vi.fn(),
  markTaskPromoted: vi.fn(),
}))

// Stub applyOpsReview — tests assert on this mock.
const applyOpsReviewMock = vi.fn()
vi.mock(`@TBE/utils/agent/opsPromotion`, () => ({
  proposeOpsAction: vi.fn(),
  applyOpsReview: (...args: unknown[]) => applyOpsReviewMock(...args),
  executeOpsAction: vi.fn(),
  revertOpsAction: vi.fn(),
}))

import { buildOpsReviewContext, persistOpsReviews } from './executor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services }, embeddings: null } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

const fenced = (fence: string, payload: unknown) =>
  `preamble\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

const makeRow = (
  overrides: Partial<{
    id: string
    action: string
    agentId: string
    params: Record<string, unknown>
    dryRunResult: Record<string, unknown>
    rollback: Record<string, unknown>
    scanResult: Record<string, unknown>
  }> = {}
) => ({
  id: `op_row1`,
  action: `restartDeployment`,
  agentId: `ag_1`,
  params: { deployment: `tdsk-backend` },
  dryRunResult: { ok: true, data: { deployment: `tdsk-backend`, wouldRestart: true } },
  rollback: { kind: `restart`, prevRevision: `42` },
  scanResult: { passed: true, findings: [] },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// buildOpsReviewContext
// ---------------------------------------------------------------------------

describe(`buildOpsReviewContext`, () => {
  it(`returns '' when opsAction.listByStatus returns empty`, async () => {
    const listByStatus = vi.fn().mockResolvedValue({ data: [] })
    const out = await buildOpsReviewContext(
      buildApp({ opsAction: { listByStatus } }),
      schedule()
    )
    expect(out).toBe(``)
    expect(listByStatus).toHaveBeenCalledWith(`org-1`, EOpsActionStatus.dryRun)
  })

  it(`renders both row ids + their action in the output`, async () => {
    const rows = [
      makeRow({ id: `op_row1`, action: `restartDeployment` }),
      makeRow({
        id: `op_row2`,
        action: `triggerRedeploy`,
        agentId: `ag_2`,
        params: { reason: `release` },
      }),
    ]
    const listByStatus = vi.fn().mockResolvedValue({ data: rows })
    const out = await buildOpsReviewContext(
      buildApp({ opsAction: { listByStatus } }),
      schedule()
    )
    expect(out).toContain(`op_row1`)
    expect(out).toContain(`op_row2`)
    expect(out).toContain(`restartDeployment`)
    expect(out).toContain(`triggerRedeploy`)
    expect(out).toContain(`tdsk-ops-reviews`)
  })

  it(`output includes adversary approval gate heading`, async () => {
    const rows = [makeRow()]
    const listByStatus = vi.fn().mockResolvedValue({ data: rows })
    const out = await buildOpsReviewContext(
      buildApp({ opsAction: { listByStatus } }),
      schedule()
    )
    expect(out).toContain(`Ops actions awaiting review`)
    expect(out).toContain(`adversary approval gate`)
  })

  it(`output includes approve ONLY rules instruction`, async () => {
    const rows = [makeRow()]
    const listByStatus = vi.fn().mockResolvedValue({ data: rows })
    const out = await buildOpsReviewContext(
      buildApp({ opsAction: { listByStatus } }),
      schedule()
    )
    expect(out).toContain(`approve ONLY`)
  })

  it(`caps at OpsReviewInjectMax entries`, async () => {
    const rows = Array.from({ length: OpsReviewInjectMax + 5 }, (_, i) =>
      makeRow({ id: `op_r${i}` })
    )
    const listByStatus = vi.fn().mockResolvedValue({ data: rows })
    const out = await buildOpsReviewContext(
      buildApp({ opsAction: { listByStatus } }),
      schedule()
    )
    // Count unique op_ id occurrences
    const matches = out.match(/op_r\d+/g) ?? []
    const unique = new Set(matches)
    expect(unique.size).toBeLessThanOrEqual(OpsReviewInjectMax)
  })

  it(`returns '' and never throws when the service rejects`, async () => {
    const listByStatus = vi.fn().mockRejectedValue(new Error(`db down`))
    const out = await buildOpsReviewContext(
      buildApp({ opsAction: { listByStatus } }),
      schedule()
    )
    expect(out).toBe(``)
  })
})

// ---------------------------------------------------------------------------
// persistOpsReviews
// ---------------------------------------------------------------------------

describe(`persistOpsReviews`, () => {
  it(`calls applyOpsReview for each approve and reject entry`, async () => {
    applyOpsReviewMock.mockResolvedValue({ status: EOpsActionStatus.executed })

    const payload = [
      { opsActionId: `op_approve1`, approve: true, reason: `safe and scoped` },
      { opsActionId: `op_reject1`, approve: false, reason: `params out of scope` },
    ]
    const stdout = fenced(OpsReviewsBlockFence, payload)
    const app = buildApp({})

    await persistOpsReviews(app, schedule({ id: `sd_9` }), `ag_1`, stdout)

    expect(applyOpsReviewMock).toHaveBeenCalledTimes(2)
    const [app1, db1, orgId1, review1, by1] = applyOpsReviewMock.mock.calls[0]
    expect(app1).toBe(app)
    expect(db1).toBe(app.locals.db)
    expect(orgId1).toBe(`org-1`)
    expect(review1).toEqual({
      opsActionId: `op_approve1`,
      approve: true,
      reason: `safe and scoped`,
    })
    expect(by1).toBe(`ag_1`)

    const [app2, db2, orgId2, review2, by2] = applyOpsReviewMock.mock.calls[1]
    expect(app2).toBe(app)
    expect(db2).toBe(app.locals.db)
    expect(orgId2).toBe(`org-1`)
    expect(review2).toEqual({
      opsActionId: `op_reject1`,
      approve: false,
      reason: `params out of scope`,
    })
    expect(by2).toBe(`ag_1`)
  })

  it(`does not call applyOpsReview when stdout has no ops-reviews block`, async () => {
    await persistOpsReviews(
      buildApp({}),
      schedule(),
      `ag_1`,
      `just a normal report with no blocks`
    )
    expect(applyOpsReviewMock).not.toHaveBeenCalled()
  })

  it(`does not call applyOpsReview when block is empty array`, async () => {
    const stdout = fenced(OpsReviewsBlockFence, [])
    await persistOpsReviews(buildApp({}), schedule(), `ag_1`, stdout)
    expect(applyOpsReviewMock).not.toHaveBeenCalled()
  })

  it(`swallows per-entry errors — loop continues after one failure`, async () => {
    applyOpsReviewMock
      .mockRejectedValueOnce(new Error(`db exploded`))
      .mockResolvedValueOnce({ status: EOpsActionStatus.rejected })

    const payload = [
      { opsActionId: `op_fail`, approve: true },
      { opsActionId: `op_ok`, approve: false, reason: `rejected` },
    ]
    const stdout = fenced(OpsReviewsBlockFence, payload)

    await expect(
      persistOpsReviews(buildApp({}), schedule(), `ag_2`, stdout)
    ).resolves.toBeUndefined()

    // Both entries attempted despite first throwing
    expect(applyOpsReviewMock).toHaveBeenCalledTimes(2)
  })

  it(`resolves without throwing even when applyOpsReview always throws`, async () => {
    applyOpsReviewMock.mockRejectedValue(new Error(`total meltdown`))

    const payload = [{ opsActionId: `op_boom`, approve: true }]
    const stdout = fenced(OpsReviewsBlockFence, payload)

    await expect(
      persistOpsReviews(buildApp({}), schedule(), `ag_3`, stdout)
    ).resolves.toBeUndefined()
  })
})
