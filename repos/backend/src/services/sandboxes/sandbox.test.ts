import { logger } from '@TBE/utils/logger'
import { Exception, EContainerState } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SandboxService } from '@TBE/services/sandboxes/sandbox'

const mockCreateProxyMiddleware = vi.fn()
vi.mock(`http-proxy-middleware`, () => ({
  createProxyMiddleware: (...args: any[]) => mockCreateProxyMiddleware(...args),
}))

const mockResolveProviderEnv = vi.fn()
vi.mock(`@TBE/utils/sandbox/resolveProviderEnv`, () => ({
  resolveProviderEnv: (...args: any[]) => mockResolveProviderEnv(...args),
}))

vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn(),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const mockBuildPodManifest = vi.fn()
const mockToContainerState = vi.fn()
const MockKubeSandboxInstance = { exec: vi.fn() }

vi.mock(`@tdsk/sandbox`, () => {
  const KubeSandbox = vi.fn(() => MockKubeSandboxInstance)
  return {
    KubeSandbox,
    PodLabelKeys: {
      orgId: `tdsk.app/org-id`,
      userId: `tdsk.app/user-id`,
      managed: `tdsk.app/managed`,
      sandboxId: `tdsk.app/sandbox-id`,
      projectId: `tdsk.app/project-id`,
    },
    sanitizeLabel: (value: string) =>
      value
        .replace(/[^a-zA-Z0-9._-]/g, ``)
        .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ``)
        .slice(0, 63),
    buildPodManifest: (...args: any[]) => mockBuildPodManifest(...args),
    toContainerState: (...args: any[]) => mockToContainerState(...args),
  }
})

let nanoidCounter = 0
vi.mock(`nanoid`, () => ({
  nanoid: (size: number) => `mock-nanoid-${nanoidCounter++}`.slice(0, size),
}))

const makeKube = () => ({
  getPod: vi.fn(),
  createPod: vi.fn(),
  deletePod: vi.fn(),
  listPods: vi.fn(),
})

const makeDb = () => ({
  services: {
    sandbox: {
      get: vi.fn(),
    },
    provider: {
      get: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
})

describe(`SandboxService`, () => {
  let kube: ReturnType<typeof makeKube>
  let db: ReturnType<typeof makeDb>
  let svc: SandboxService

  beforeEach(() => {
    vi.clearAllMocks()
    nanoidCounter = 0
    SandboxService.proxyMap.clear()
    kube = makeKube()
    db = makeDb()
    svc = new SandboxService(kube as any, db as any)
  })

  describe(`validatePodOwnership`, () => {
    it(`should pass when pod orgId label matches provided orgId`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { labels: { [`tdsk.app/org-id`]: `org-1` } },
      })

      await expect(svc.validatePodOwnership(`pod-a`, `org-1`)).resolves.toBeUndefined()
      expect(kube.getPod).toHaveBeenCalledWith(`pod-a`)
    })

    it(`should throw 403 when pod orgId label does not match`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { labels: { [`tdsk.app/org-id`]: `org-other` } },
      })

      await expect(svc.validatePodOwnership(`pod-a`, `org-1`)).rejects.toThrow(
        `Pod does not belong to this organization`
      )

      try {
        kube.getPod.mockResolvedValue({
          metadata: { labels: { [`tdsk.app/org-id`]: `org-other` } },
        })
        await svc.validatePodOwnership(`pod-a`, `org-1`)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(403)
      }
    })

    it(`should throw 403 when pod has no orgId label`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { labels: {} },
      })

      await expect(svc.validatePodOwnership(`pod-a`, `org-1`)).rejects.toThrow(
        `Pod does not belong to this organization`
      )
    })

    it(`should throw 404 when pod is not found (404 via code)`, async () => {
      const kubeError = Object.assign(new Error(`Not Found`), { code: 404 })
      kube.getPod.mockRejectedValue(kubeError)

      await expect(svc.validatePodOwnership(`missing-pod`, `org-1`)).rejects.toThrow(
        `Pod missing-pod no longer exists`
      )
    })

    it(`should throw 404 when pod is not found (404 via statusCode)`, async () => {
      const kubeError = Object.assign(new Error(`Not Found`), { statusCode: 404 })
      kube.getPod.mockRejectedValue(kubeError)

      await expect(svc.validatePodOwnership(`missing-pod`, `org-1`)).rejects.toThrow(
        `Pod missing-pod no longer exists`
      )
    })

    it(`should propagate non-404 KubeClient.getPod errors`, async () => {
      const kubeError = Object.assign(new Error(`Internal Server Error`), {
        statusCode: 500,
      })
      kube.getPod.mockRejectedValue(kubeError)

      await expect(svc.validatePodOwnership(`missing-pod`, `org-1`)).rejects.toThrow(
        `Internal Server Error`
      )
    })

    it(`should pass when projectId matches pod label`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: {
            [`tdsk.app/org-id`]: `org-1`,
            [`tdsk.app/project-id`]: `proj-1`,
          },
        },
      })

      await expect(
        svc.validatePodOwnership(`pod-a`, `org-1`, `proj-1`)
      ).resolves.toBeUndefined()
    })

    it(`should throw 403 when projectId does not match pod label`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: {
            [`tdsk.app/org-id`]: `org-1`,
            [`tdsk.app/project-id`]: `proj-other`,
          },
        },
      })

      await expect(svc.validatePodOwnership(`pod-a`, `org-1`, `proj-1`)).rejects.toThrow(
        `Pod does not belong to this project`
      )
    })

    it(`should skip project check when projectId is undefined`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: {
            [`tdsk.app/org-id`]: `org-1`,
            [`tdsk.app/project-id`]: `proj-1`,
          },
        },
      })

      await expect(
        svc.validatePodOwnership(`pod-a`, `org-1`, undefined)
      ).resolves.toBeUndefined()
    })

    it(`should skip project check when pod has no project label`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: { [`tdsk.app/org-id`]: `org-1` },
        },
      })

      await expect(
        svc.validatePodOwnership(`pod-a`, `org-1`, `proj-1`)
      ).resolves.toBeUndefined()
    })

    it(`should pass when projectId has leading chars stripped by sanitizeLabel`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: {
            [`tdsk.app/org-id`]: `org-1`,
            [`tdsk.app/project-id`]: `TvYOseQjO`,
          },
        },
      })

      await expect(
        svc.validatePodOwnership(`pod-a`, `org-1`, `_TvYOseQjO`)
      ).resolves.toBeUndefined()
    })
  })

  describe(`startPod`, () => {
    const baseOpts = {
      orgId: `org-1`,
      userId: `user-1`,
      sandboxId: `sb-1`,
      projectId: `proj-1`,
      egressOpts: { serviceName: `egress`, servicePort: 8080, certSecretName: `cert` },
    }

    it(`should create pod manifest and call kube.createPod, return podName`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: { id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] },
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      const result = await svc.startPod(baseOpts as any)

      expect(result).toBe(`tdsk-sb-test`)
      expect(db.services.sandbox.get).toHaveBeenCalledWith(`sb-1`)
      expect(mockBuildPodManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: `org-1`,
          userId: `user-1`,
          projectId: `proj-1`,
          egressOpts: baseOpts.egressOpts,
        })
      )
      expect(kube.createPod).toHaveBeenCalledWith({ metadata: { name: `tdsk-sb-test` } })
    })

    it(`should generate placeholder tokens for each secretId in config`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: {
          id: `sb-1`,
          config: { image: `node:20`, secretIds: [`sec-a`, `sec-b`] },
          sandboxProviders: [],
        },
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      const placeholders = manifestCall.placeholders as Record<string, string>
      const tokens = Object.keys(placeholders)

      expect(tokens).toHaveLength(2)
      for (const token of tokens) {
        expect(token).toMatch(/^tdsk_ph_/)
      }

      const secretIds = Object.values(placeholders)
      expect(secretIds).toContain(`sec-a`)
      expect(secretIds).toContain(`sec-b`)
    })

    it(`should throw when sandbox config not found in DB`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: null,
        error: new Error(`not found`),
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Sandbox config not found: sb-1`
      )
    })

    it(`should throw 400 when sandbox config missing image field`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: { id: `sb-1`, config: {} },
        error: null,
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Sandbox config is missing required "image" field`
      )

      try {
        db.services.sandbox.get.mockResolvedValue({
          data: { id: `sb-1`, config: {} },
          error: null,
        })
        await svc.startPod(baseOpts as any)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(400)
      }
    })

    it(`should throw when createPod returns pod without metadata.name`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: { id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] },
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: {} })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Pod created but metadata.name is missing for sandbox sb-1`
      )
    })

    it(`should pass egressOpts through to buildPodManifest`, async () => {
      const customEgress = {
        serviceName: `custom-egress`,
        servicePort: 9090,
        certSecretName: `custom-cert`,
      }
      db.services.sandbox.get.mockResolvedValue({
        data: { id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] },
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod({ ...baseOpts, egressOpts: customEgress } as any)

      expect(mockBuildPodManifest).toHaveBeenCalledWith(
        expect.objectContaining({ egressOpts: customEgress })
      )
    })

    it(`should pass provider extraEnv and placeholders to buildPodManifest when providers are linked`, async () => {
      const mockProvider = { id: `prov-1`, brand: `anthropic`, secretId: `sec-1` }
      db.services.sandbox.get.mockResolvedValue({
        data: {
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code` },
          providerLinks: [{ provider: mockProvider, priority: 0, model: undefined }],
        },
        error: null,
      })
      mockResolveProviderEnv.mockResolvedValue({
        extraEnv: { ANTHROPIC_API_KEY: `tdsk_ph_mock` },
        placeholders: { tdsk_ph_mock: `sec-1` },
        errors: [],
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.extraEnv.ANTHROPIC_API_KEY).toBe(`tdsk_ph_mock`)
      expect(manifestCall.placeholders.tdsk_ph_mock).toBe(`sec-1`)
    })

    it(`should throw Exception(400) when provider resolution has errors`, async () => {
      const mockProvider = { id: `prov-1`, brand: `anthropic`, secretId: `sec-1` }
      db.services.sandbox.get.mockResolvedValue({
        data: {
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code` },
          providerLinks: [{ provider: mockProvider, priority: 0, model: undefined }],
        },
        error: null,
      })
      mockResolveProviderEnv.mockResolvedValue({
        extraEnv: {},
        placeholders: {},
        errors: [`Missing provider secret`],
      })

      try {
        await svc.startPod(baseOpts as any)
        expect.fail(`Expected startPod to throw`)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(400)
        expect((err as Error).message).toContain(`Provider auth configuration error`)
      }
    })

    it(`should create pod without provider env when sandbox has no linked providers`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: { id: `sb-1`, config: { image: `node:20` }, providerLinks: [] },
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      const result = await svc.startPod(baseOpts as any)

      expect(result).toBe(`tdsk-sb-test`)
      expect(mockResolveProviderEnv).not.toHaveBeenCalled()
    })
  })

  describe(`idle timeout`, () => {
    it(`should stop pods seeded via updateActivity after timeout expires`, async () => {
      kube.deletePod.mockResolvedValue(undefined)
      kube.getPod.mockResolvedValue({
        metadata: { labels: { [`tdsk.app/sandbox-id`]: `sb-1` } },
      })
      db.services.sandbox.get.mockResolvedValue({
        data: { config: { idleTimeoutMinutes: 0.001 } },
        error: null,
      })

      // Seed activity as initKube would after hydrating an existing pod
      svc.updateActivity(`orphan-pod`)

      // Start the idle timeout loop with a very short interval
      const original = svc[`config`] as Record<string, any>
      Object.defineProperty(svc, `config`, {
        value: { ...original, idleInterval: 50 },
        writable: true,
      })
      svc.startIdleTimeout()

      // Wait for the interval to fire and process the idle pod
      await new Promise((resolve) => setTimeout(resolve, 200))
      svc.stopIdleTimeout()

      expect(kube.deletePod).toHaveBeenCalledWith(`orphan-pod`, 30)
    })

    it(`should not stop pods that have active sessions`, async () => {
      kube.deletePod.mockResolvedValue(undefined)

      svc.updateActivity(`active-pod`)
      svc.addSession(`active-pod`, {
        orgId: `org-1`,
        userId: `user-1`,
        podName: `active-pod`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
      })

      const original2 = svc[`config`] as Record<string, any>
      Object.defineProperty(svc, `config`, {
        value: { ...original2, idleInterval: 50, timeoutMin: 0 },
        writable: true,
      })
      svc.startIdleTimeout()

      await new Promise((resolve) => setTimeout(resolve, 200))
      svc.stopIdleTimeout()

      expect(kube.deletePod).not.toHaveBeenCalled()
    })
  })

  describe(`stopPod`, () => {
    it(`should call kube.deletePod with 30s grace period`, async () => {
      kube.deletePod.mockResolvedValue(undefined)

      await svc.stopPod(`pod-a`)

      expect(kube.deletePod).toHaveBeenCalledWith(`pod-a`, 30)
    })

    it(`should propagate kube.deletePod errors`, async () => {
      kube.deletePod.mockRejectedValue(new Error(`pod not found`))

      await expect(svc.stopPod(`pod-a`)).rejects.toThrow(`pod not found`)
    })
  })

  describe(`getPodState`, () => {
    it(`should return Running for a running pod`, async () => {
      kube.getPod.mockResolvedValue({ status: { phase: `Running` } })
      mockToContainerState.mockReturnValue(EContainerState.Running)

      const result = await svc.getPodState(`pod-a`)

      expect(result).toBe(EContainerState.Running)
      expect(mockToContainerState).toHaveBeenCalledWith(`Running`)
    })

    it(`should return Pending for a pending pod`, async () => {
      kube.getPod.mockResolvedValue({ status: { phase: `Pending` } })
      mockToContainerState.mockReturnValue(EContainerState.Pending)

      const result = await svc.getPodState(`pod-a`)

      expect(result).toBe(EContainerState.Pending)
    })

    it(`should return Failed for 404 via code path (ApiException)`, async () => {
      const err = Object.assign(new Error(`Not Found`), { code: 404 })
      kube.getPod.mockRejectedValue(err)

      const result = await svc.getPodState(`gone-pod`)

      expect(result).toBe(EContainerState.Failed)
    })

    it(`should return Failed for 404 via statusCode path`, async () => {
      const err = Object.assign(new Error(`Not Found`), { statusCode: 404 })
      kube.getPod.mockRejectedValue(err)

      const result = await svc.getPodState(`gone-pod`)

      expect(result).toBe(EContainerState.Failed)
    })

    it(`should return Failed for 404 via response.statusCode path`, async () => {
      const err = Object.assign(new Error(`Not Found`), {
        response: { statusCode: 404 },
      })
      kube.getPod.mockRejectedValue(err)

      const result = await svc.getPodState(`gone-pod`)

      expect(result).toBe(EContainerState.Failed)
    })

    it(`should re-throw non-404 errors`, async () => {
      const err = Object.assign(new Error(`Forbidden`), { statusCode: 403 })
      kube.getPod.mockRejectedValue(err)

      await expect(svc.getPodState(`pod-a`)).rejects.toThrow(`Forbidden`)
    })
  })

  describe(`getSandbox`, () => {
    it(`should return KubeSandbox instance for a running pod`, async () => {
      kube.getPod.mockResolvedValue({ status: { phase: `Running` } })
      mockToContainerState.mockReturnValue(EContainerState.Running)

      const result = await svc.getSandbox(`pod-a`)

      expect(result).toBe(MockKubeSandboxInstance)
    })

    it(`should throw when pod is not Running`, async () => {
      kube.getPod.mockResolvedValue({ status: { phase: `Pending` } })
      mockToContainerState.mockReturnValue(EContainerState.Pending)

      await expect(svc.getSandbox(`pod-a`)).rejects.toThrow(
        `Pod pod-a is not running (state: Pending)`
      )
    })
  })

  describe(`listPods`, () => {
    it(`should build label selectors from filter`, async () => {
      kube.listPods.mockResolvedValue([])

      await svc.listPods({ orgId: `org-1`, userId: `user-1`, projectId: `proj-1` })

      const selector = kube.listPods.mock.calls[0][0] as string
      expect(selector).toContain(`tdsk.app/managed=true`)
      expect(selector).toContain(`tdsk.app/org-id=org-1`)
      expect(selector).toContain(`tdsk.app/user-id=user-1`)
      expect(selector).toContain(`tdsk.app/project-id=proj-1`)
    })

    it(`should filter by state client-side when state is provided`, async () => {
      kube.listPods.mockResolvedValue([
        { status: { phase: `Running` } },
        { status: { phase: `Pending` } },
        { status: { phase: `Running` } },
      ])

      const result = await svc.listPods({ state: EContainerState.Running })

      expect(result).toHaveLength(2)
      expect(result.every((p: any) => p.status.phase === `Running`)).toBe(true)
    })

    it(`should return all pods when no filter`, async () => {
      const pods = [{ status: { phase: `Running` } }, { status: { phase: `Pending` } }]
      kube.listPods.mockResolvedValue(pods)

      const result = await svc.listPods()

      expect(result).toEqual(pods)
      const selector = kube.listPods.mock.calls[0][0] as string
      expect(selector).toBe(`tdsk.app/managed=true`)
    })
  })

  describe(`static methods`, () => {
    it(`getPodProxy should create and cache proxy middleware`, () => {
      const mockProxy = vi.fn()
      mockCreateProxyMiddleware.mockReturnValue(mockProxy)

      const proxy = SandboxService.getPodProxy(`http://10.0.0.1:3000`)

      expect(proxy).toBe(mockProxy)
      expect(mockCreateProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          target: `http://10.0.0.1:3000`,
          ws: false,
          changeOrigin: true,
        })
      )
      expect(SandboxService.proxyMap.get(`http://10.0.0.1:3000`)).toBe(mockProxy)
    })

    it(`getPodProxy should return cached proxy on second call with same target`, () => {
      const mockProxy = vi.fn()
      mockCreateProxyMiddleware.mockReturnValue(mockProxy)

      const first = SandboxService.getPodProxy(`http://10.0.0.1:3000`)
      const second = SandboxService.getPodProxy(`http://10.0.0.1:3000`)

      expect(first).toBe(second)
      expect(mockCreateProxyMiddleware).toHaveBeenCalledTimes(1)
    })

    it(`removePodProxy should delete from cache`, () => {
      const mockProxy = vi.fn()
      SandboxService.proxyMap.set(`http://10.0.0.1:3000`, mockProxy as any)

      SandboxService.removePodProxy(`http://10.0.0.1:3000`)

      expect(SandboxService.proxyMap.has(`http://10.0.0.1:3000`)).toBe(false)
    })

    it(`proxy error handler should log and return 502 when headers not sent`, () => {
      const mockProxy = vi.fn()
      mockCreateProxyMiddleware.mockReturnValue(mockProxy)
      SandboxService.proxyMap.clear()

      SandboxService.getPodProxy(`http://10.0.0.1:4000`)

      const callArgs = mockCreateProxyMiddleware.mock.calls[0][0]
      const errorHandler = callArgs.on.error

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
        headersSent: false,
      }

      errorHandler(new Error(`connection refused`), {}, mockRes)

      expect(logger.error).toHaveBeenCalledWith(
        `[SandboxProxy] Proxy error for http://10.0.0.1:4000:`,
        `connection refused`
      )
      expect(mockRes.writeHead).toHaveBeenCalledWith(502, {
        [`Content-Type`]: `application/json`,
      })
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({ error: `Sandbox proxy error` })
      )
    })
  })
})
