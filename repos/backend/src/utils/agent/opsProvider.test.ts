import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EOpsActionStatus } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPodStatus = vi.fn().mockResolvedValue({ ok: true, pods: [] })
const mockPodLogs = vi.fn().mockResolvedValue({ ok: true, logs: `some logs` })
const mockDeployState = vi.fn().mockResolvedValue({ ok: true, deployments: [] })
const mockQuotaUsage = vi.fn().mockResolvedValue({ ok: true, quotas: [] })

vi.mock(`@TBE/services/ops/ops`, () => ({
  createOpsService: vi.fn(() => ({
    podStatus: mockPodStatus,
    podLogs: mockPodLogs,
    deployState: mockDeployState,
    quotaUsage: mockQuotaUsage,
  })),
}))

const mockProposeOpsAction = vi.fn()
vi.mock(`@TBE/utils/agent/opsPromotion`, () => ({
  proposeOpsAction: mockProposeOpsAction,
}))

// Import AFTER mocks
const { createOpsProvider } = await import('./opsProvider')

// ── Tests ──────────────────────────────────────────────────────────────────────

describe(`createOpsProvider`, () => {
  const app = { locals: { kube: {} } } as any
  const db = { services: { opsAction: { create: vi.fn() } } } as any
  const orgId = `og_1`
  const agentId = `ag_1`

  let provider: ReturnType<typeof createOpsProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = createOpsProvider(app, db, orgId, agentId)
  })

  it(`podStatus delegates to the service with ctx threaded`, async () => {
    const result = await provider.podStatus({ component: `tdsk-backend` })
    expect(result.ok).toBe(true)
    expect(mockPodStatus).toHaveBeenCalledWith(
      { component: `tdsk-backend` },
      { orgId, agentId }
    )
  })

  it(`podLogs delegates to the service with ctx threaded`, async () => {
    const result = await provider.podLogs({ component: `tdsk-backend`, tailLines: 50 })
    expect(result.ok).toBe(true)
    expect(mockPodLogs).toHaveBeenCalledWith(
      { component: `tdsk-backend`, tailLines: 50 },
      { orgId, agentId }
    )
  })

  it(`deployState delegates to the service with ctx threaded`, async () => {
    const result = await provider.deployState({})
    expect(result.ok).toBe(true)
    expect(mockDeployState).toHaveBeenCalledWith({}, { orgId, agentId })
  })

  it(`quotaUsage delegates to the service with ctx threaded`, async () => {
    const result = await provider.quotaUsage({})
    expect(result.ok).toBe(true)
    expect(mockQuotaUsage).toHaveBeenCalledWith({}, { orgId, agentId })
  })

  // propose now calls proposeOpsAction — no longer throws
  it(`propose delegates to proposeOpsAction and returns dryRun result`, async () => {
    mockProposeOpsAction.mockResolvedValueOnce({
      opsActionId: `oa_1`,
      status: EOpsActionStatus.dryRun,
      findings: [],
      dryRun: { deployment: `tdsk-backend`, wouldRestart: true },
    })

    const result = await provider.propose(`restartDeployment`, {
      deployment: `tdsk-backend`,
      reason: `test`,
    })

    expect(result).toMatchObject({ opsActionId: `oa_1`, status: EOpsActionStatus.dryRun })
    expect(mockProposeOpsAction).toHaveBeenCalledWith(
      app,
      db,
      orgId,
      agentId,
      `restartDeployment`,
      { deployment: `tdsk-backend`, reason: `test` },
      { authoredBy: agentId }
    )
    // Read-tier service methods not involved
    expect(mockPodStatus).not.toHaveBeenCalled()
    expect(mockDeployState).not.toHaveBeenCalled()
  })

  it(`propose returns rejected result when proposeOpsAction scan fails`, async () => {
    mockProposeOpsAction.mockResolvedValueOnce({
      opsActionId: `oa_2`,
      status: EOpsActionStatus.rejected,
      findings: [`[deploy-allowlist] deployment 'nonsense' not in OpsAllowedDeployments`],
      dryRun: null,
    })

    const result = await provider.propose(`restartDeployment`, {
      deployment: `nonsense`,
      reason: `test`,
    })

    expect(result).toMatchObject({
      opsActionId: `oa_2`,
      status: EOpsActionStatus.rejected,
    })
    expect((result as any).findings.length).toBeGreaterThan(0)
  })
})
