import { describe, it, expect, vi, beforeEach } from 'vitest'

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

  it(`propose throws a loud D6-stub error and does NOT call any service`, async () => {
    await expect(
      provider.propose(`restartDeployment`, {
        deployment: `tdsk-backend`,
        reason: `test`,
      })
    ).rejects.toThrow(`[P4d D5] Ops write proposal not yet wired`)
    // No service methods should have been called
    expect(mockPodStatus).not.toHaveBeenCalled()
    expect(mockDeployState).not.toHaveBeenCalled()
  })

  it(`propose error message includes the attempted action name`, async () => {
    await expect(
      provider.propose(`triggerRedeploy`, { reason: `urgent` })
    ).rejects.toThrow(`triggerRedeploy`)
  })
})
