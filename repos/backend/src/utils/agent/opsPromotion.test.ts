import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EOpsAction, EOpsActionStatus } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ── Mock scanOpsAction ─────────────────────────────────────────────────────────

const mockScanOpsAction = vi.fn()
vi.mock(`./opsScan`, () => ({
  scanOpsAction: mockScanOpsAction,
}))

// Import AFTER mocks
const { proposeOpsAction, executeOpsAction, applyOpsReview } = await import(
  `./opsPromotion`
)

// ── Builders ───────────────────────────────────────────────────────────────────

const makeDb = (overrides: Record<string, any> = {}) => {
  const opsActionCreate = vi.fn().mockResolvedValue({ data: { id: `oa_1` } })
  const opsActionGet = vi.fn()
  const opsActionUpdate = vi.fn().mockResolvedValue({ data: {} })
  const sandboxGet = vi
    .fn()
    .mockResolvedValue({
      data: { id: `sb_1`, orgId: `og_1`, config: { runtime: `node` } },
    })

  return {
    db: {
      services: {
        opsAction: {
          create: opsActionCreate,
          get: opsActionGet,
          update: opsActionUpdate,
        },
        sandbox: { get: sandboxGet },
        ...overrides,
      },
    } as any,
    opsActionCreate,
    opsActionGet,
    opsActionUpdate,
    sandboxGet,
  }
}

const makeApp = (imageTag = `ghcr.io/org/tdsk-backend:sha-abc1234`) => {
  const readDeployment = vi
    .fn()
    .mockResolvedValue({ name: `tdsk-backend`, revision: `3`, image: imageTag })

  return {
    app: {
      locals: {
        kube: { readDeployment },
      },
    } as any,
    readDeployment,
  }
}

const passedScan = { passed: true, findings: [] }
const failedScan = {
  passed: false,
  findings: [`[deploy-allowlist] deployment 'nonsense' not in OpsAllowedDeployments`],
}

// ── proposeOpsAction ──────────────────────────────────────────────────────────

describe(`proposeOpsAction`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // Test 1: scan fail → row status:'rejected', kube.readDeployment NOT called
  it(`scan fail → creates rejected audit row and does NOT call kube.readDeployment`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(failedScan)

    const result = await proposeOpsAction(
      a.app,
      m.db,
      `og_1`,
      `ag_1`,
      EOpsAction.restartDeployment,
      { deployment: `nonsense`, reason: `test` }
    )

    expect(result.status).toBe(EOpsActionStatus.rejected)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.opsActionId).toBe(`oa_1`)
    expect(result.dryRun).toBeNull()

    // kube.readDeployment must NOT have been called
    expect(a.readDeployment).not.toHaveBeenCalled()

    // opsAction.create called with rejected status
    const insert = m.opsActionCreate.mock.calls[0][0]
    expect(insert.status).toBe(EOpsActionStatus.rejected)
    expect(insert.orgId).toBe(`og_1`)
    expect(insert.agentId).toBe(`ag_1`)
    expect(insert.dryRun).toBe(true)
  })

  // Test 2: restartDeployment valid → scan passes, readDeployment called, row status:'dryRun'
  it(`restartDeployment valid → readDeployment called, row status dryRun with rollback.kind=restart`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)

    const result = await proposeOpsAction(
      a.app,
      m.db,
      `og_1`,
      `ag_1`,
      EOpsAction.restartDeployment,
      { deployment: `tdsk-backend`, reason: `OOM killing pods` }
    )

    expect(result.status).toBe(EOpsActionStatus.dryRun)
    expect(result.findings).toEqual([])
    expect(result.opsActionId).toBe(`oa_1`)
    expect(result.dryRun).toBeDefined()

    // readDeployment was called
    expect(a.readDeployment).toHaveBeenCalledWith(`tdsk-backend`)

    // opsAction.create called with dryRun status + rollback
    const insert = m.opsActionCreate.mock.calls[0][0]
    expect(insert.status).toBe(EOpsActionStatus.dryRun)
    expect(insert.dryRun).toBe(true)
    expect(insert.rollback).toEqual({ kind: `restart`, prevRevision: `3` })
    expect(insert.dryRunResult.ok).toBe(true)
    expect(insert.dryRunResult.data.currentRevision).toBe(`3`)
  })

  // Test 3: triggerRedeploy valid → row status:'dryRun' with rollback:{kind:'redeploy', prevSha:...}
  it(`triggerRedeploy valid → row status dryRun with rollback.kind=redeploy and SHA extracted`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)

    const result = await proposeOpsAction(
      a.app,
      m.db,
      `og_1`,
      `ag_1`,
      EOpsAction.triggerRedeploy,
      { reason: `Deploy urgent patch` }
    )

    expect(result.status).toBe(EOpsActionStatus.dryRun)
    expect(result.dryRun).toBeDefined()

    // readDeployment called on tdsk-backend for SHA extraction
    expect(a.readDeployment).toHaveBeenCalledWith(`tdsk-backend`)

    const insert = m.opsActionCreate.mock.calls[0][0]
    expect(insert.status).toBe(EOpsActionStatus.dryRun)
    expect(insert.rollback).toEqual({ kind: `redeploy`, prevSha: `abc1234` })
    expect(insert.dryRunResult.data.prevSha).toBe(`abc1234`)
  })

  // Test 3b: triggerRedeploy with no SHA in image tag → prevSha null
  it(`triggerRedeploy with non-sha image tag → prevSha is null`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    a = makeApp(`ghcr.io/org/tdsk-backend:latest`)

    const result = await proposeOpsAction(
      a.app,
      m.db,
      `og_1`,
      `ag_1`,
      EOpsAction.triggerRedeploy,
      { reason: `Deploy patch` }
    )

    expect(result.status).toBe(EOpsActionStatus.dryRun)
    const insert = m.opsActionCreate.mock.calls[0][0]
    expect(insert.rollback).toEqual({ kind: `redeploy`, prevSha: null })
  })

  // Test 4: applySandboxConfig valid → row status:'dryRun' with rollback.prevConfig + plan.diff
  it(`applySandboxConfig valid → row dryRun with rollback.kind=sandboxConfig and diff`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)

    const result = await proposeOpsAction(
      a.app,
      m.db,
      `og_1`,
      `ag_1`,
      EOpsAction.applySandboxConfig,
      {
        sandboxId: `sb_1`,
        patch: { runtime: `bun`, idleTimeoutMinutes: 30 },
        reason: `update runtime`,
      }
    )

    expect(result.status).toBe(EOpsActionStatus.dryRun)
    expect(result.dryRun).toBeDefined()

    // sandbox.get was called
    expect(m.sandboxGet).toHaveBeenCalledWith(`sb_1`)

    const insert = m.opsActionCreate.mock.calls[0][0]
    expect(insert.status).toBe(EOpsActionStatus.dryRun)
    expect(insert.rollback).toEqual({
      kind: `sandboxConfig`,
      prevConfig: { runtime: `node` },
    })
    // diff should show per-key from→to
    expect(insert.dryRunResult.data.diff.runtime).toEqual({ from: `node`, to: `bun` })
    expect(insert.dryRunResult.data.diff.idleTimeoutMinutes).toEqual({
      from: undefined,
      to: 30,
    })
    expect(insert.dryRunResult.data.prevConfig).toEqual({ runtime: `node` })
  })

  it(`throws when the DB create fails`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    m.opsActionCreate.mockResolvedValue({ error: { message: `db boom` } })

    await expect(
      proposeOpsAction(a.app, m.db, `og_1`, `ag_1`, EOpsAction.restartDeployment, {
        deployment: `tdsk-backend`,
        reason: `test`,
      })
    ).rejects.toThrow(`db boom`)
  })
})

// ── executeOpsAction ──────────────────────────────────────────────────────────

describe(`executeOpsAction`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  const dryRunRow = {
    id: `oa_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    action: EOpsAction.restartDeployment,
    params: { deployment: `tdsk-backend`, reason: `OOM` },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // Test 5: dryRun row → re-scan passes → dispatchExecute throws D7 stub → row status:'failed'
  it(`re-scan passes → dispatchExecute throws D7 stub → row status failed, result.error mentions stub`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.failed)
    expect(result.result.ok).toBe(false)
    expect(result.result.error).toMatch(/D7/)

    // opsAction.update called with failed status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.id).toBe(`oa_1`)
    expect(upd.status).toBe(EOpsActionStatus.failed)
    expect(upd.dryRun).toBe(false)
  })

  // Test 6: re-scan fails → row status:'rejected', dispatchExecute NOT called
  it(`re-scan fails → row status rejected, dispatchExecute not invoked`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(failedScan)

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.rejected)
    expect(result.result).toEqual({ ok: false, error: `rescan-failed` })

    // update called with rejected status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.status).toBe(EOpsActionStatus.rejected)
    // Never reached the dispatch phase, so no 'executed' or 'failed' call
    expect(m.opsActionUpdate).toHaveBeenCalledTimes(1)
  })

  it(`throws if row is not in dryRun status`, async () => {
    const badRow = { ...dryRunRow, status: EOpsActionStatus.executed }
    await expect(executeOpsAction(a.app, m.db, badRow)).rejects.toThrow(`dryRun`)
  })
})

// ── applyOpsReview ────────────────────────────────────────────────────────────

describe(`applyOpsReview`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  const dryRunRow = {
    id: `oa_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    action: EOpsAction.restartDeployment,
    params: { deployment: `tdsk-backend`, reason: `OOM` },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
    // Default: get returns the dryRun row
    m.opsActionGet.mockResolvedValue({ data: { ...dryRunRow } })
  })

  // Test 7: approve=true → verdict recorded → executeOpsAction invoked (fails on D7 stub - expected)
  it(`approve=true → verdict recorded, executeOpsAction invoked (D7 stub failure expected)`, async () => {
    // Re-scan inside executeOpsAction passes
    mockScanOpsAction.mockResolvedValue(passedScan)
    // Second get (for refreshed row) returns same row
    m.opsActionGet
      .mockResolvedValueOnce({ data: { ...dryRunRow } }) // initial get
      .mockResolvedValueOnce({ data: { ...dryRunRow } }) // refreshed get inside applyOpsReview

    const result = await applyOpsReview(
      a.app,
      m.db,
      `og_1`,
      {
        opsActionId: `oa_1`,
        approve: true,
        reason: `looks good`,
      },
      `auditor_1`
    )

    // result comes from executeOpsAction which fails on D7 stub
    expect(result).not.toBeNull()
    expect(result!.status).toBe(EOpsActionStatus.failed)

    // First update: verdict recording
    const verdictUpd = m.opsActionUpdate.mock.calls[0][0]
    expect(verdictUpd.reviewVerdict).toEqual({
      approved: true,
      reason: `looks good`,
      by: `auditor_1`,
    })

    // Second update: failed status from executeOpsAction
    const execUpd = m.opsActionUpdate.mock.calls[1][0]
    expect(execUpd.status).toBe(EOpsActionStatus.failed)
  })

  // Test 8: approve=false → row status:'rejected', verdict recorded, executeOpsAction NOT called
  it(`approve=false → row status rejected, verdict recorded, executeOpsAction not invoked`, async () => {
    const result = await applyOpsReview(
      a.app,
      m.db,
      `og_1`,
      {
        opsActionId: `oa_1`,
        approve: false,
        reason: `too risky`,
      },
      `auditor_1`
    )

    expect(result).not.toBeNull()
    expect(result!.status).toBe(EOpsActionStatus.rejected)

    // Only one update call (the reject)
    expect(m.opsActionUpdate).toHaveBeenCalledTimes(1)
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.status).toBe(EOpsActionStatus.rejected)
    expect(upd.reviewVerdict).toEqual({
      approved: false,
      reason: `too risky`,
      by: `auditor_1`,
    })

    // scanOpsAction never called (no execute path)
    expect(mockScanOpsAction).not.toHaveBeenCalled()
  })

  // Test 9: terminal row → returns null, no calls
  it.each([
    EOpsActionStatus.executed,
    EOpsActionStatus.failed,
    EOpsActionStatus.rejected,
  ])(`terminal row (status=%s) → returns null, no updates`, async (terminalStatus) => {
    m.opsActionGet.mockResolvedValue({ data: { ...dryRunRow, status: terminalStatus } })

    const result = await applyOpsReview(a.app, m.db, `og_1`, {
      opsActionId: `oa_1`,
      approve: true,
    })

    expect(result).toBeNull()
    expect(m.opsActionUpdate).not.toHaveBeenCalled()
    expect(mockScanOpsAction).not.toHaveBeenCalled()
  })

  it(`returns null when row not found`, async () => {
    m.opsActionGet.mockResolvedValue({ data: null })

    const result = await applyOpsReview(a.app, m.db, `og_1`, {
      opsActionId: `oa_missing`,
      approve: true,
    })

    expect(result).toBeNull()
    expect(m.opsActionUpdate).not.toHaveBeenCalled()
  })

  it(`returns null for cross-org row`, async () => {
    m.opsActionGet.mockResolvedValue({ data: { ...dryRunRow, orgId: `og_other` } })

    const result = await applyOpsReview(a.app, m.db, `og_1`, {
      opsActionId: `oa_1`,
      approve: true,
    })

    expect(result).toBeNull()
    expect(m.opsActionUpdate).not.toHaveBeenCalled()
  })
})
