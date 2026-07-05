import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockScanOpsAction = vi.fn()
vi.mock(`@TBE/utils/agent/opsScan`, () => ({
  scanOpsAction: (...args: any[]) => mockScanOpsAction(...args),
}))

// ── Test helpers ───────────────────────────────────────────────────────────────

const POD_LIST = [
  {
    name: `tdsk-backend-abc`,
    phase: `Running`,
    restartCount: 0,
    image: `ghcr.io/example:sha-abc1234`,
    node: `node-1`,
  },
]

const QUOTAS = [
  {
    name: `compute-quota`,
    hard: { cpu: `8`, memory: `16Gi` },
    used: { cpu: `2`, memory: `4Gi` },
  },
]

const makeDeps = () => {
  const opsActionCreate = vi.fn().mockResolvedValue({ data: { id: `oa_1` } })

  const kube = {
    listPodsBySelector: vi.fn().mockResolvedValue(POD_LIST),
    readPodLogs: vi.fn().mockResolvedValue(`log line 1\nlog line 2`),
    readDeployment: vi.fn().mockImplementation(async (name: string) => ({
      name,
      replicas: { desired: 2, ready: 2, available: 2, updated: 2 },
      image: `ghcr.io/example:sha-abc1234`,
      revision: `5`,
      conditions: [{ name: `Available`, status: `True` }],
    })),
    listResourceQuotas: vi.fn().mockResolvedValue(QUOTAS),
  }

  const db = {
    services: {
      opsAction: { create: opsActionCreate },
    },
  } as any

  const app = {
    locals: { kube },
  } as any

  return { kube, db, app, opsActionCreate }
}

// Import AFTER mocks are registered
const { createOpsService } = await import('./ops')

// ── Tests ──────────────────────────────────────────────────────────────────────

describe(`createOpsService`, () => {
  let deps: ReturnType<typeof makeDeps>
  let svc: ReturnType<typeof createOpsService>
  const ctx = { orgId: `og_1`, agentId: `ag_1` }

  beforeEach(() => {
    vi.clearAllMocks()
    deps = makeDeps()
    svc = createOpsService(deps.app, deps.db)
    // Default: scan passes
    mockScanOpsAction.mockResolvedValue({ passed: true, findings: [] })
  })

  // ── podStatus ───────────────────────────────────────────────────────────────

  describe(`podStatus`, () => {
    it(`calls listPodsBySelector with component label and returns pods`, async () => {
      const result = await svc.podStatus({ component: `tdsk-backend` }, ctx)
      expect(result.ok).toBe(true)
      expect(result.pods).toEqual(POD_LIST)
      expect(deps.kube.listPodsBySelector).toHaveBeenCalledWith(
        `app.kubernetes.io/component=tdsk-backend`
      )
    })

    it(`writes audit row with status executed and dryRun false`, async () => {
      await svc.podStatus({ component: `tdsk-backend` }, ctx)
      expect(deps.opsActionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: `podStatus`,
          status: `executed`,
          dryRun: false,
          orgId: `og_1`,
          agentId: `ag_1`,
        })
      )
    })

    it(`calls listPodsBySelector with pod-name label when podName is given`, async () => {
      await svc.podStatus({ podName: `my-pod-0` }, ctx)
      expect(deps.kube.listPodsBySelector).toHaveBeenCalledWith(
        `statefulset.kubernetes.io/pod-name=my-pod-0`
      )
    })

    it(`returns error when neither component nor podName provided`, async () => {
      const result = await svc.podStatus({}, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/component or podName required/i)
      expect(deps.kube.listPodsBySelector).not.toHaveBeenCalled()
    })

    it(`scan fail: writes rejected audit row, does NOT call kube, returns ok false`, async () => {
      mockScanOpsAction.mockResolvedValue({
        passed: false,
        findings: [`[deploy-allowlist] bad component`],
      })
      const result = await svc.podStatus({ component: `tdsk-backend` }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/scan failed/i)
      expect(deps.kube.listPodsBySelector).not.toHaveBeenCalled()
      expect(deps.opsActionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: `rejected`,
          dryRun: false,
        })
      )
    })

    it(`kube error: writes failed audit row, does not rethrow`, async () => {
      deps.kube.listPodsBySelector.mockRejectedValue(new Error(`k8s connection refused`))
      const result = await svc.podStatus({ component: `tdsk-backend` }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/k8s connection refused/i)
      expect(deps.opsActionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ status: `failed`, dryRun: false })
      )
    })
  })

  // ── podLogs ─────────────────────────────────────────────────────────────────

  describe(`podLogs`, () => {
    it(`calls readPodLogs with podName and tailLines forwarded`, async () => {
      const result = await svc.podLogs(
        { component: `tdsk-backend`, podName: `my-pod-0`, tailLines: 100 },
        ctx
      )
      expect(result.ok).toBe(true)
      expect(result.logs).toBe(`log line 1\nlog line 2`)
      expect(deps.kube.readPodLogs).toHaveBeenCalledWith(
        `my-pod-0`,
        expect.objectContaining({
          tailLines: 100,
          previous: false,
          container: `tdsk-backend`,
        })
      )
    })

    it(`resolves podName from component when podName is omitted`, async () => {
      // listPodsBySelector returns POD_LIST for component; readPodLogs uses first pod name
      await svc.podLogs({ component: `tdsk-backend`, tailLines: 50 }, ctx)
      expect(deps.kube.listPodsBySelector).toHaveBeenCalledWith(
        `app.kubernetes.io/component=tdsk-backend`
      )
      expect(deps.kube.readPodLogs).toHaveBeenCalledWith(
        `tdsk-backend-abc`,
        expect.objectContaining({ tailLines: 50 })
      )
    })

    it(`scan fail (tailLines > cap): writes rejected, kube NOT called`, async () => {
      mockScanOpsAction.mockResolvedValue({
        passed: false,
        findings: [`[params] podLogs.tailLines 10000 exceeds cap 500`],
      })
      const result = await svc.podLogs(
        { component: `tdsk-backend`, tailLines: 10000 },
        ctx
      )
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/scan failed/i)
      expect(deps.kube.readPodLogs).not.toHaveBeenCalled()
      expect(deps.opsActionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ status: `rejected`, dryRun: false })
      )
    })
  })

  // ── deployState ─────────────────────────────────────────────────────────────

  describe(`deployState`, () => {
    it(`reads ALL OpsAllowedDeployments when deployment omitted`, async () => {
      const result = await svc.deployState({}, ctx)
      expect(result.ok).toBe(true)
      // Should have called readDeployment for each allowed deployment
      expect(deps.kube.readDeployment).toHaveBeenCalledTimes(5) // OpsAllowedDeployments.length
      expect(result.deployments.length).toBe(5)
    })

    it(`extracts deployedSha from image tag`, async () => {
      const result = await svc.deployState({}, ctx)
      expect(result.ok).toBe(true)
      // image is `ghcr.io/example:sha-abc1234` → deployedSha=`abc1234`
      expect(result.deployments[0].deployedSha).toBe(`abc1234`)
    })

    it(`reads only specified deployment when deployment param is given`, async () => {
      const result = await svc.deployState({ deployment: `tdsk-backend` }, ctx)
      expect(result.ok).toBe(true)
      expect(result.deployments.length).toBe(1)
      expect(deps.kube.readDeployment).toHaveBeenCalledTimes(1)
      expect(deps.kube.readDeployment).toHaveBeenCalledWith(`tdsk-backend`)
    })

    it(`kube error: writes failed audit row, does not rethrow`, async () => {
      deps.kube.readDeployment.mockRejectedValue(new Error(`Deployment not found`))
      const result = await svc.deployState({ deployment: `tdsk-backend` }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
      expect(deps.opsActionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ status: `failed`, dryRun: false })
      )
    })

    it(`deployedSha is undefined when image tag does not match sha pattern`, async () => {
      deps.kube.readDeployment.mockResolvedValue({
        name: `tdsk-backend`,
        replicas: { desired: 1, ready: 1, available: 1, updated: 1 },
        image: `ghcr.io/example:latest`,
        revision: `3`,
        conditions: [],
      })
      const result = await svc.deployState({ deployment: `tdsk-backend` }, ctx)
      expect(result.ok).toBe(true)
      expect(result.deployments[0].deployedSha).toBeUndefined()
    })
  })

  // ── quotaUsage ───────────────────────────────────────────────────────────────

  describe(`quotaUsage`, () => {
    it(`calls listResourceQuotas and returns quotas`, async () => {
      const result = await svc.quotaUsage({}, ctx)
      expect(result.ok).toBe(true)
      expect(result.quotas).toEqual(QUOTAS)
      expect(deps.kube.listResourceQuotas).toHaveBeenCalled()
    })

    it(`writes executed audit row`, async () => {
      await svc.quotaUsage({}, ctx)
      expect(deps.opsActionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: `quotaUsage`,
          status: `executed`,
          dryRun: false,
        })
      )
    })
  })
})
