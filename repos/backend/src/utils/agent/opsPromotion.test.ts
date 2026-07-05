import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { EOpsAction, EOpsActionStatus, EMemoryKind } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ── Mock scanOpsAction ─────────────────────────────────────────────────────────

const mockScanOpsAction = vi.fn()
vi.mock(`./opsScan`, () => ({
  scanOpsAction: mockScanOpsAction,
}))

// Import AFTER mocks
const { proposeOpsAction, executeOpsAction, applyOpsReview, revertOpsAction } =
  await import(`./opsPromotion`)

// ── Builders ───────────────────────────────────────────────────────────────────

const makeDb = (overrides: Record<string, any> = {}) => {
  const opsActionCreate = vi.fn().mockResolvedValue({ data: { id: `oa_1` } })
  const opsActionGet = vi.fn()
  const opsActionUpdate = vi.fn().mockResolvedValue({ data: {} })
  const sandboxGet = vi.fn().mockResolvedValue({
    data: { id: `sb_1`, orgId: `og_1`, config: { runtime: `node` } },
  })
  const sandboxUpdate = vi.fn().mockResolvedValue({ data: { id: `sb_1` } })
  const memoryCreate = vi.fn().mockResolvedValue({ data: { id: `mem_1` } })

  return {
    db: {
      services: {
        opsAction: {
          create: opsActionCreate,
          get: opsActionGet,
          update: opsActionUpdate,
        },
        sandbox: { get: sandboxGet, update: sandboxUpdate },
        memory: { create: memoryCreate },
        ...overrides,
      },
    } as any,
    opsActionCreate,
    opsActionGet,
    opsActionUpdate,
    sandboxGet,
    sandboxUpdate,
    memoryCreate,
  }
}

const makeApp = (imageTag = `ghcr.io/org/tdsk-backend:sha-abc1234`) => {
  const readDeployment = vi.fn().mockResolvedValue({
    name: `tdsk-backend`,
    revision: `3`,
    image: imageTag,
    replicas: { desired: 2, ready: 2, updated: 2 },
  })
  const restartDeployment = vi.fn().mockResolvedValue(undefined)
  const rollbackDeployment = vi.fn().mockResolvedValue(undefined)

  return {
    app: {
      locals: {
        kube: { readDeployment, restartDeployment, rollbackDeployment },
      },
    } as any,
    readDeployment,
    restartDeployment,
    rollbackDeployment,
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

// ── executeOpsAction — restart executor (D7) ──────────────────────────────────

describe(`executeOpsAction — restartDeployment executor`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  const dryRunRow = {
    id: `oa_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    action: EOpsAction.restartDeployment,
    params: { deployment: `tdsk-backend`, reason: `OOM` },
    rollback: { kind: `restart`, prevRevision: `3` },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // Happy path: kube.restartDeployment called; poll returns ready → row goes to executed
  it(`happy path: restartDeployment called, poll returns ready → row executed with replicas data`, async () => {
    vi.useFakeTimers()
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    // readDeployment returns ready on first poll
    a.readDeployment.mockResolvedValue({
      name: `tdsk-backend`,
      revision: `4`,
      image: `ghcr.io/org/tdsk-backend:sha-def5678`,
      replicas: { desired: 2, ready: 2, updated: 2 },
    })

    const execPromise = executeOpsAction(a.app, m.db, dryRunRow)
    // Advance past one poll step so the first poll fires
    await vi.advanceTimersByTimeAsync(6_000)
    const result = await execPromise

    expect(result.status).toBe(EOpsActionStatus.executed)
    expect(result.result.ok).toBe(true)
    expect(result.result.data.deployment).toBe(`tdsk-backend`)
    expect(result.result.data.replicas).toBeDefined()
    expect(result.result.data.revision).toBe(`4`)

    // restartDeployment was called
    expect(a.restartDeployment).toHaveBeenCalledWith(`tdsk-backend`)

    // opsAction.update called with executed status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.id).toBe(`oa_1`)
    expect(upd.status).toBe(EOpsActionStatus.executed)
    expect(upd.dryRun).toBe(false)

    vi.useRealTimers()
  })

  // Timeout path: poll never returns ready → rollbackDeployment called + row fails
  it(`timeout path: poll never ready → rollbackDeployment called with prevRevision, row fails`, async () => {
    vi.useFakeTimers()
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    // readDeployment always returns not-ready
    a.readDeployment.mockResolvedValue({
      name: `tdsk-backend`,
      revision: `3`,
      image: `ghcr.io/org/tdsk-backend:sha-abc1234`,
      replicas: { desired: 2, ready: 0, updated: 0 },
    })

    // Advance time past the timeout (3 min = 180000ms) in between each poll step
    const execPromise = executeOpsAction(a.app, m.db, dryRunRow)

    // Advance time by slightly more than the 3-minute timeout
    await vi.advanceTimersByTimeAsync(185_000)

    const result = await execPromise

    expect(result.status).toBe(EOpsActionStatus.failed)
    expect(result.result.ok).toBe(false)
    expect(result.result.error).toMatch(/timed out/)
    expect(result.result.error).toMatch(/annotation-based rollout revert/)

    // rollbackDeployment called with prevRevision from rollback data
    expect(a.rollbackDeployment).toHaveBeenCalledWith(`tdsk-backend`, `3`)

    // opsAction.update called with failed status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.id).toBe(`oa_1`)
    expect(upd.status).toBe(EOpsActionStatus.failed)
    expect(upd.result.error).toMatch(/timed out/)

    vi.useRealTimers()
  })
})

// ── executeOpsAction — redeploy executor (D8) ─────────────────────────────────

describe(`executeOpsAction — triggerRedeploy executor`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  const dryRunRow = {
    id: `oa_redeploy_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    action: EOpsAction.triggerRedeploy,
    params: { reason: `urgent patch`, forceAll: false },
    rollback: { kind: `redeploy`, prevSha: `abc1234` },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // Happy path: memory.create called with correct text + meta; row goes to executed
  it(`happy path: memory.create called with redeploy intent, row goes to executed`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.executed)
    expect(result.result.ok).toBe(true)
    expect(result.result.data.prevSha).toBe(`abc1234`)
    expect(result.result.data.note).toMatch(/no-new-secret/)

    // memory.create called with correct fields
    expect(m.memoryCreate).toHaveBeenCalledTimes(1)
    const memCall = m.memoryCreate.mock.calls[0][0]
    expect(memCall.text).toMatch(/Ops redeploy requested/)
    expect(memCall.text).toMatch(/oa_redeploy_1/)
    expect(memCall.text).toMatch(/abc1234/)
    expect(memCall.kind).toBe(EMemoryKind.fact)
    expect(memCall.importance).toBe(6)
    expect(memCall.meta.opsActionId).toBe(`oa_redeploy_1`)
    expect(memCall.meta.prevSha).toBe(`abc1234`)
    expect(memCall.meta.source).toBe(`ops`)
    expect(memCall.orgId).toBe(`og_1`)
    expect(memCall.agentId).toBe(`ag_1`)

    // opsAction.update called with executed status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.status).toBe(EOpsActionStatus.executed)
    expect(upd.dryRun).toBe(false)
  })

  // Memory-write failure is non-fatal: logs warn but returns ok:true
  it(`memory-write failure is non-fatal: returns ok:true and row executed`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    m.memoryCreate.mockRejectedValueOnce(new Error(`DB connection lost`))

    const { logger } = await import(`@TBE/utils/logger`)

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.executed)
    expect(result.result.ok).toBe(true)

    // warn was called
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/memory-write failed/))

    // row still updated to executed
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.status).toBe(EOpsActionStatus.executed)
  })
})

// ── executeOpsAction — applySandboxConfig executor (D8) ───────────────────────

describe(`executeOpsAction — applySandboxConfig executor`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  const dryRunRow = {
    id: `oa_sb_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    action: EOpsAction.applySandboxConfig,
    params: {
      sandboxId: `sb_1`,
      patch: { runtime: `bun`, idleTimeoutMinutes: 30 },
      reason: `update`,
    },
    rollback: { kind: `sandboxConfig`, prevConfig: { runtime: `node` } },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // Happy path: sandbox.update called with merged config; row goes to executed
  it(`happy path: sandbox.update called with merged config, row goes to executed`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.executed)
    expect(result.result.ok).toBe(true)
    expect(result.result.data.sandboxId).toBe(`sb_1`)
    expect(result.result.data.appliedKeys).toContain(`runtime`)
    expect(result.result.data.appliedKeys).toContain(`idleTimeoutMinutes`)
    expect(result.result.data.note).toMatch(/NEXT pod start/)

    // sandbox.update called with merged config
    expect(m.sandboxUpdate).toHaveBeenCalledTimes(1)
    const updateCall = m.sandboxUpdate.mock.calls[0][0]
    expect(updateCall.id).toBe(`sb_1`)
    // config should be merged: prev { runtime: 'node' } + patch { runtime: 'bun', idleTimeoutMinutes: 30 }
    expect(updateCall.config).toEqual({ runtime: `bun`, idleTimeoutMinutes: 30 })

    // opsAction.update called with executed status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.status).toBe(EOpsActionStatus.executed)
  })

  // Sandbox not found → executor throws → row status:'failed'
  it(`sandbox not found → executor throws, row status failed`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    m.sandboxGet.mockResolvedValueOnce({ data: null, error: { message: `not found` } })

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.failed)
    expect(result.result.ok).toBe(false)
    expect(result.result.error).toMatch(/not found/)

    // opsAction.update called with failed status
    const upd = m.opsActionUpdate.mock.calls[0][0]
    expect(upd.status).toBe(EOpsActionStatus.failed)
  })

  // sandbox.update failure → executor throws → row status:'failed'
  it(`sandbox.update failure → row status failed`, async () => {
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    m.sandboxUpdate.mockResolvedValueOnce({ error: { message: `update boom` } })

    const result = await executeOpsAction(a.app, m.db, dryRunRow)

    expect(result.status).toBe(EOpsActionStatus.failed)
    expect(result.result.error).toMatch(/update boom/)
  })
})

// ── executeOpsAction — legacy tests ──────────────────────────────────────────

describe(`executeOpsAction`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  const dryRunRow = {
    id: `oa_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    action: EOpsAction.restartDeployment,
    params: { deployment: `tdsk-backend`, reason: `OOM` },
    rollback: { kind: `restart`, prevRevision: `3` },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // re-scan passes → dispatchExecute runs (now happy path for restart)
  it(`re-scan passes → restartDeployment executor runs, row executed`, async () => {
    vi.useFakeTimers()
    mockScanOpsAction.mockResolvedValueOnce(passedScan)
    // readDeployment returns ready replicas
    a.readDeployment.mockResolvedValue({
      name: `tdsk-backend`,
      revision: `4`,
      image: `ghcr.io/org/tdsk-backend:sha-def`,
      replicas: { desired: 2, ready: 2, updated: 2 },
    })

    const execPromise = executeOpsAction(a.app, m.db, dryRunRow)
    await vi.advanceTimersByTimeAsync(6_000)
    const result = await execPromise

    expect(result.status).toBe(EOpsActionStatus.executed)
    expect(result.result.ok).toBe(true)

    vi.useRealTimers()
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
    rollback: { kind: `restart`, prevRevision: `3` },
    status: EOpsActionStatus.dryRun,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
    // Default: get returns the dryRun row
    m.opsActionGet.mockResolvedValue({ data: { ...dryRunRow } })
  })

  // Test 7: approve=true → verdict recorded → executeOpsAction invoked (succeeds now)
  it(`approve=true → verdict recorded, executeOpsAction invoked and succeeds`, async () => {
    vi.useFakeTimers()
    // Re-scan inside executeOpsAction passes
    mockScanOpsAction.mockResolvedValue(passedScan)
    // readDeployment returns ready
    a.readDeployment.mockResolvedValue({
      name: `tdsk-backend`,
      revision: `4`,
      image: `ghcr.io/org/tdsk-backend:sha-def`,
      replicas: { desired: 2, ready: 2, updated: 2 },
    })
    // Second get (for refreshed row) returns same row
    m.opsActionGet
      .mockResolvedValueOnce({ data: { ...dryRunRow } }) // initial get
      .mockResolvedValueOnce({ data: { ...dryRunRow } }) // refreshed get inside applyOpsReview

    const reviewPromise = applyOpsReview(
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
    // Advance timers past the first poll step so the restart executor resolves
    await vi.advanceTimersByTimeAsync(6_000)
    const result = await reviewPromise

    // result comes from executeOpsAction which now succeeds
    expect(result).not.toBeNull()
    expect(result!.status).toBe(EOpsActionStatus.executed)

    // First update: verdict recording
    const verdictUpd = m.opsActionUpdate.mock.calls[0][0]
    expect(verdictUpd.reviewVerdict).toEqual({
      approved: true,
      reason: `looks good`,
      by: `auditor_1`,
    })

    // Second update: executed status from executeOpsAction
    const execUpd = m.opsActionUpdate.mock.calls[1][0]
    expect(execUpd.status).toBe(EOpsActionStatus.executed)

    vi.useRealTimers()
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

// ── revertOpsAction ───────────────────────────────────────────────────────────

describe(`revertOpsAction`, () => {
  let m: ReturnType<typeof makeDb>
  let a: ReturnType<typeof makeApp>

  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
    a = makeApp()
  })

  // sandboxConfig row: writes prevConfig back
  it(`sandboxConfig row: writes prevConfig back to sandbox.update`, async () => {
    const row = {
      id: `oa_sb_1`,
      orgId: `og_1`,
      agentId: `ag_1`,
      action: EOpsAction.applySandboxConfig,
      params: { sandboxId: `sb_1`, patch: { runtime: `bun` } },
      rollback: { kind: `sandboxConfig`, prevConfig: { runtime: `node` } },
      status: EOpsActionStatus.executed,
    }
    m.opsActionGet.mockResolvedValueOnce({ data: row })

    const result = await revertOpsAction(a.app, m.db, `oa_sb_1`)

    expect(result.ok).toBe(true)
    expect(result.data.kind).toBe(`sandboxConfig`)
    expect(result.data.sandboxId).toBe(`sb_1`)

    // sandbox.update called with prevConfig
    expect(m.sandboxUpdate).toHaveBeenCalledTimes(1)
    const upd = m.sandboxUpdate.mock.calls[0][0]
    expect(upd.id).toBe(`sb_1`)
    expect(upd.config).toEqual({ runtime: `node` })
  })

  // restart row: calls kube.rollbackDeployment with prevRevision
  it(`restart row: calls kube.rollbackDeployment with name and prevRevision`, async () => {
    const row = {
      id: `oa_rs_1`,
      orgId: `og_1`,
      agentId: `ag_1`,
      action: EOpsAction.restartDeployment,
      params: { deployment: `tdsk-backend`, reason: `OOM` },
      rollback: { kind: `restart`, prevRevision: `3` },
      status: EOpsActionStatus.executed,
    }
    m.opsActionGet.mockResolvedValueOnce({ data: row })

    const result = await revertOpsAction(a.app, m.db, `oa_rs_1`)

    expect(result.ok).toBe(true)
    expect(result.data.kind).toBe(`restart`)
    expect(result.data.deployment).toBe(`tdsk-backend`)
    expect(result.data.revertedTo).toBe(`3`)

    // rollbackDeployment called
    expect(a.rollbackDeployment).toHaveBeenCalledWith(`tdsk-backend`, `3`)
  })

  // redeploy row: writes memory.create with source 'ops-revert', returns ok:true
  it(`redeploy row: writes memory.create with source ops-revert, returns ok:true`, async () => {
    const row = {
      id: `oa_rd_1`,
      orgId: `og_1`,
      agentId: `ag_1`,
      action: EOpsAction.triggerRedeploy,
      params: { reason: `patch`, forceAll: false },
      rollback: { kind: `redeploy`, prevSha: `abc1234` },
      status: EOpsActionStatus.executed,
    }
    m.opsActionGet.mockResolvedValueOnce({ data: row })

    const result = await revertOpsAction(a.app, m.db, `oa_rd_1`)

    expect(result.ok).toBe(true)
    expect(result.data.kind).toBe(`redeploy`)
    expect(result.data.prevSha).toBe(`abc1234`)

    // memory.create called with source 'ops-revert'
    expect(m.memoryCreate).toHaveBeenCalledTimes(1)
    const memCall = m.memoryCreate.mock.calls[0][0]
    expect(memCall.meta.source).toBe(`ops-revert`)
    expect(memCall.meta.opsActionId).toBe(`oa_rd_1`)
    expect(memCall.meta.prevSha).toBe(`abc1234`)
    expect(memCall.text).toMatch(/REVERT/)
    expect(memCall.kind).toBe(EMemoryKind.fact)
  })

  // missing row → returns {ok:false, error: 'ops-action <id> not found'}
  it(`missing row → returns {ok:false, error containing 'not found'}`, async () => {
    m.opsActionGet.mockResolvedValueOnce({ data: null })

    const result = await revertOpsAction(a.app, m.db, `oa_missing`)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/oa_missing/)
    expect(result.error).toMatch(/not found/)
  })

  // row without rollback data → returns {ok:false, error: 'no rollback data...'}
  it(`row without rollback data → returns {ok:false, error 'no rollback data'}`, async () => {
    const row = {
      id: `oa_no_rb`,
      orgId: `og_1`,
      agentId: `ag_1`,
      action: EOpsAction.restartDeployment,
      params: { deployment: `tdsk-backend`, reason: `test` },
      rollback: null,
      status: EOpsActionStatus.executed,
    }
    m.opsActionGet.mockResolvedValueOnce({ data: row })

    const result = await revertOpsAction(a.app, m.db, `oa_no_rb`)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no rollback data/)
  })

  // sandbox.update failure in revert → returns {ok:false, error}
  it(`sandboxConfig revert: sandbox.update failure → returns {ok:false, error}`, async () => {
    const row = {
      id: `oa_sb_err`,
      orgId: `og_1`,
      agentId: `ag_1`,
      action: EOpsAction.applySandboxConfig,
      params: { sandboxId: `sb_1`, patch: { runtime: `bun` } },
      rollback: { kind: `sandboxConfig`, prevConfig: { runtime: `node` } },
      status: EOpsActionStatus.executed,
    }
    m.opsActionGet.mockResolvedValueOnce({ data: row })
    m.sandboxUpdate.mockResolvedValueOnce({ error: { message: `restore boom` } })

    const result = await revertOpsAction(a.app, m.db, `oa_sb_err`)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/restore boom/)
  })
})
