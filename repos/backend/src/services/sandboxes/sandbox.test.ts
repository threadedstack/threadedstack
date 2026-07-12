import { logger } from '@TBE/utils/logger'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SandboxService } from '@TBE/services/sandboxes/sandbox'
import { SandboxProxyTimeoutMs } from '@TBE/constants/sandbox'
import {
  SandboxHomePath,
  Exception,
  EContainerState,
  ESandboxSessionVisibility,
} from '@tdsk/domain'

const sbx = (data: Record<string, any>) => {
  // startPod refuses sandboxes whose orgId does not match the caller's orgId,
  // so test fixtures default to the org used by the shared baseOpts
  data.orgId = data.orgId ?? `org-1`
  data.getEffectiveConfig = function () {
    return this
  }
  data.getProjectAlias = function () {
    return undefined
  }
  data.getProjectConfig = function () {
    return undefined
  }
  data.getGitProviders = function (projectId: string) {
    return (this.gitProviderLinks || []).filter((l: any) => l.projectId === projectId)
  }
  return data
}

const mockCreateProxyMiddleware = vi.fn()
vi.mock(`http-proxy-middleware`, () => ({
  createProxyMiddleware: (...args: any[]) => mockCreateProxyMiddleware(...args),
}))

const mockResolveProviderEnv = vi.fn()
vi.mock(`@TBE/utils/sandbox/resolveProviderEnv`, () => ({
  resolveProviderEnv: (...args: any[]) => mockResolveProviderEnv(...args),
}))

const mockResolveGitProviderEnv = vi.fn()
vi.mock(`@TBE/utils/sandbox/resolveGitProviderEnv`, () => ({
  resolveGitProviderEnv: (...args: any[]) => mockResolveGitProviderEnv(...args),
}))

const mockResolveDockerPullSecrets = vi.fn()
vi.mock(`@TBE/utils/sandbox/resolveDockerPullSecrets`, () => ({
  resolveDockerPullSecrets: (...args: any[]) => mockResolveDockerPullSecrets(...args),
}))

const mockResolveSkillFiles = vi.fn()
vi.mock(`@TBE/utils/sandbox/resolveSkillFiles`, () => ({
  resolveSkillFiles: (...args: any[]) => mockResolveSkillFiles(...args),
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
    PodAnnotationKeys: {
      ports: `tdsk.app/ports`,
      subdomain: `tdsk.app/subdomain`,
      placeholders: `tdsk.app/placeholders`,
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
  runInPod: vi.fn(),
  deleteSecret: vi.fn(),
  createDockerRegistrySecret: vi.fn(),
  patchSecretOwnerReferences: vi.fn(),
  createConfigMap: vi.fn(),
  deleteConfigMap: vi.fn(),
  patchConfigMapOwnerReferences: vi.fn(),
  findSubdomainByInstance: vi.fn(),
  updateRoutePort: vi.fn(),
  removeRoutePort: vi.fn(),
  patchPodAnnotation: vi.fn(),
  // startPod resolves the egress DNAT target from a ready pod of the egress
  // deployment — default: one ready pod so launches succeed.
  listPodsBySelector: vi.fn().mockResolvedValue([
    {
      name: `tdsk-egress-abc`,
      phase: `Running`,
      restartCount: 0,
      image: `backend:test`,
      node: `node-1`,
      podIp: `10.0.9.9`,
      ready: true,
    },
  ]),
  routes: {} as Record<string, any>,
})

const makeDb = () => ({
  services: {
    sandbox: {
      get: vi.fn(),
      listSkillsForSandbox: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
    provider: {
      get: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    sandboxStartingClaim: {
      claimStarting: vi.fn().mockResolvedValue({ data: { id: `ssc_test01` } }),
      releaseStarting: vi.fn().mockResolvedValue({ data: { id: `ssc_test01` } }),
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
    mockResolveGitProviderEnv.mockResolvedValue({
      errors: [],
      extraEnv: {},
      placeholders: {},
    })
  })

  describe(`validateInstanceOwnership`, () => {
    it(`should pass when pod orgId label matches provided orgId`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { labels: { [`tdsk.app/org-id`]: `org-1` } },
      })

      await expect(
        svc.validateInstanceOwnership(`pod-a`, `org-1`)
      ).resolves.toBeUndefined()
      expect(kube.getPod).toHaveBeenCalledWith(`pod-a`)
    })

    it(`should throw 403 when pod orgId label does not match`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { labels: { [`tdsk.app/org-id`]: `org-other` } },
      })

      await expect(svc.validateInstanceOwnership(`pod-a`, `org-1`)).rejects.toThrow(
        `Pod does not belong to this organization`
      )

      try {
        kube.getPod.mockResolvedValue({
          metadata: { labels: { [`tdsk.app/org-id`]: `org-other` } },
        })
        await svc.validateInstanceOwnership(`pod-a`, `org-1`)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(403)
      }
    })

    it(`should throw 403 when pod has no orgId label`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { labels: {} },
      })

      await expect(svc.validateInstanceOwnership(`pod-a`, `org-1`)).rejects.toThrow(
        `Pod does not belong to this organization`
      )
    })

    it(`should throw 404 when pod is not found (404 via code)`, async () => {
      const kubeError = Object.assign(new Error(`Not Found`), { code: 404 })
      kube.getPod.mockRejectedValue(kubeError)

      await expect(svc.validateInstanceOwnership(`missing-pod`, `org-1`)).rejects.toThrow(
        `Pod missing-pod no longer exists`
      )
    })

    it(`should throw 404 when pod is not found (404 via statusCode)`, async () => {
      const kubeError = Object.assign(new Error(`Not Found`), { statusCode: 404 })
      kube.getPod.mockRejectedValue(kubeError)

      await expect(svc.validateInstanceOwnership(`missing-pod`, `org-1`)).rejects.toThrow(
        `Pod missing-pod no longer exists`
      )
    })

    it(`should propagate non-404 KubeClient.getPod errors`, async () => {
      const kubeError = Object.assign(new Error(`Internal Server Error`), {
        statusCode: 500,
      })
      kube.getPod.mockRejectedValue(kubeError)

      await expect(svc.validateInstanceOwnership(`missing-pod`, `org-1`)).rejects.toThrow(
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
        svc.validateInstanceOwnership(`pod-a`, `org-1`, `proj-1`)
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

      await expect(
        svc.validateInstanceOwnership(`pod-a`, `org-1`, `proj-1`)
      ).rejects.toThrow(`Pod does not belong to this project`)
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
        svc.validateInstanceOwnership(`pod-a`, `org-1`, undefined)
      ).resolves.toBeUndefined()
    })

    it(`should skip project check when pod has no project label`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: { [`tdsk.app/org-id`]: `org-1` },
        },
      })

      await expect(
        svc.validateInstanceOwnership(`pod-a`, `org-1`, `proj-1`)
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
        svc.validateInstanceOwnership(`pod-a`, `org-1`, `_TvYOseQjO`)
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

    it(`should create pod manifest and call kube.createPod, return instanceId`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] }),
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
          // egressOpts arrive as a CLONE with the resolved egress pod IP
          egressOpts: { ...baseOpts.egressOpts, serviceIp: `10.0.9.9` },
        })
      )
      expect(kube.createPod).toHaveBeenCalledWith({ metadata: { name: `tdsk-sb-test` } })
    })

    it(`overrides the global node pool when the per-sandbox config sets nodePool`, async () => {
      const scoped = new SandboxService(kube as any, db as any, {
        nodeSelector: { 'kubernetes.civo.com/civo-node-pool': `tdsksandbox` },
      })
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20`, nodePool: `tdskembed` },
          sandboxProviders: [],
        }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await scoped.startPod(baseOpts as any)

      expect(mockBuildPodManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeSelector: { 'kubernetes.civo.com/civo-node-pool': `tdskembed` },
        })
      )
    })

    it(`uses the global nodeSelector unchanged when the per-sandbox config omits nodePool`, async () => {
      const globalSelector = { 'kubernetes.civo.com/civo-node-pool': `tdsksandbox` }
      const scoped = new SandboxService(kube as any, db as any, {
        nodeSelector: globalSelector,
      })
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await scoped.startPod(baseOpts as any)

      expect(mockBuildPodManifest).toHaveBeenCalledWith(
        expect.objectContaining({ nodeSelector: globalSelector })
      )
    })

    it(`resolves the egress DNAT target from a READY egress pod and never mutates the shared egressOpts`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })
      // Not-ready and IP-less pods must be skipped in favor of the ready one
      kube.listPodsBySelector.mockResolvedValue([
        { name: `egress-a`, phase: `Running`, ready: false, podIp: `10.0.9.1` },
        { name: `egress-b`, phase: `Pending`, ready: true, podIp: `10.0.9.2` },
        { name: `egress-c`, phase: `Running`, ready: true, podIp: undefined },
        { name: `egress-d`, phase: `Running`, ready: true, podIp: `10.0.9.4` },
      ])

      await svc.startPod(baseOpts as any)

      // Selector targets the egress deployment from egressOpts.serviceName
      expect(kube.listPodsBySelector).toHaveBeenCalledWith(
        `app.kubernetes.io/component=egress`
      )
      expect(mockBuildPodManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          egressOpts: { ...baseOpts.egressOpts, serviceIp: `10.0.9.4` },
        })
      )
      // The shared config object must never be mutated (a per-call clone)
      expect(baseOpts.egressOpts).toEqual({
        serviceName: `egress`,
        servicePort: 8080,
        certSecretName: `cert`,
      })
    })

    it(`FAILS CLOSED with 503 when no ready egress pod exists (never launches with dead egress)`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] }),
        error: null,
      })
      kube.listPodsBySelector.mockResolvedValue([
        { name: `egress-a`, phase: `Running`, ready: false, podIp: `10.0.9.1` },
      ])

      await expect(svc.startPod(baseOpts as any)).rejects.toMatchObject({
        status: 503,
      })
      expect(kube.createPod).not.toHaveBeenCalled()
    })

    it(`should generate placeholder tokens for each secretId in config`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20`, secretIds: [`sec-a`, `sec-b`] },
          sandboxProviders: [],
        }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      const placeholders = manifestCall.placeholders as Record<
        string,
        { secretId: string }
      >
      const tokens = Object.keys(placeholders)

      expect(tokens).toHaveLength(2)
      for (const token of tokens) {
        expect(token).toMatch(/^tdsk_ph_/)
      }

      const secretIds = Object.values(placeholders).map((e) => e.secretId)
      expect(secretIds).toContain(`sec-a`)
      expect(secretIds).toContain(`sec-b`)
    })

    it(`should throw 403 when sandbox record belongs to a different org`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          orgId: `org-other`,
          config: { image: `node:20` },
          sandboxProviders: [],
        }),
        error: null,
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Sandbox sb-1 does not belong to this organization`
      )
      expect(kube.createPod).not.toHaveBeenCalled()

      try {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx({
            id: `sb-1`,
            orgId: `org-other`,
            config: { image: `node:20` },
            sandboxProviders: [],
          }),
          error: null,
        })
        await svc.startPod(baseOpts as any)
        expect.fail(`Expected startPod to throw`)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(403)
      }
    })

    it(`should throw when sandbox config not found in DB`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: null,
        error: null,
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Sandbox config not found: sb-1`
      )
    })

    it(`should throw with DB error message when sandbox fetch fails`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: null,
        error: new Error(`connection refused`),
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(`connection refused`)
    })

    it(`should throw 400 when sandbox config missing image field`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: {} }),
        error: null,
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Sandbox config is missing required "image" field`
      )

      try {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx({ id: `sb-1`, config: {} }),
          error: null,
        })
        await svc.startPod(baseOpts as any)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(400)
      }
    })

    it(`should apply project config overrides to the sandbox before building manifest`, async () => {
      const overriddenConfig = { image: `custom:latest`, workdir: `/project-a` }
      const mockSandbox = {
        id: `sb-1`,
        orgId: `org-1`,
        config: { image: `node:20`, workdir: `/workspace` },
        sandboxProviders: [],
        getEffectiveConfig: vi.fn().mockReturnValue({
          id: `sb-1`,
          config: overriddenConfig,
          providerLinks: [],
          getEffectiveConfig() {
            return this
          },
          getGitProviders() {
            return []
          },
          getProjectAlias() {
            return undefined
          },
          getProjectConfig() {
            return undefined
          },
        }),
        getGitProviders() {
          return []
        },
        getProjectAlias() {
          return undefined
        },
        getProjectConfig() {
          return undefined
        },
      }
      db.services.sandbox.get.mockResolvedValue({ data: mockSandbox, error: null })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      expect(mockSandbox.getEffectiveConfig).toHaveBeenCalledWith(`proj-1`)
      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.sandbox.config.image).toBe(`custom:latest`)
      expect(manifestCall.sandbox.config.workdir).toBe(`/project-a`)
    })

    it(`should use raw sandbox config when projectId is undefined`, async () => {
      const mockSandbox = sbx({
        id: `sb-1`,
        config: { image: `node:20` },
        sandboxProviders: [],
      })
      const spy = vi.spyOn(mockSandbox, `getEffectiveConfig`)
      db.services.sandbox.get.mockResolvedValue({ data: mockSandbox, error: null })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod({ ...baseOpts, projectId: undefined } as any)

      expect(spy).not.toHaveBeenCalled()
      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.sandbox.config.image).toBe(`node:20`)
    })

    it(`should throw when createPod returns pod without metadata.name`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] }),
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
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, sandboxProviders: [] }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod({ ...baseOpts, egressOpts: customEgress } as any)

      expect(mockBuildPodManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          egressOpts: { ...customEgress, serviceIp: `10.0.9.9` },
        })
      )
    })

    it(`should pass provider extraEnv and placeholders to buildPodManifest when providers are linked`, async () => {
      const mockProvider = {
        id: `prov-1`,
        type: `ai`,
        brand: `anthropic`,
        secretId: `sec-1`,
      }
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code` },
          providerLinks: [{ provider: mockProvider, priority: 0, model: undefined }],
        }),
        error: null,
      })
      mockResolveProviderEnv.mockResolvedValue({
        extraEnv: { ANTHROPIC_API_KEY: `tdsk_ph_mock` },
        placeholders: { tdsk_ph_mock: { secretId: `sec-1` } },
        errors: [],
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.extraEnv.ANTHROPIC_API_KEY).toBe(`tdsk_ph_mock`)
      expect(manifestCall.placeholders.tdsk_ph_mock).toEqual({ secretId: `sec-1` })
    })

    it(`should throw Exception(400) when provider resolution has errors`, async () => {
      const mockProvider = {
        id: `prov-1`,
        type: `ai`,
        brand: `anthropic`,
        secretId: `sec-1`,
      }
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code` },
          providerLinks: [{ provider: mockProvider, priority: 0, model: undefined }],
        }),
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

    it(`should call resolveGitProviderEnv when git providers are linked`, async () => {
      const gitProvider = {
        id: `prov-git`,
        brand: `github`,
        type: `git`,
        secretId: `sec-git`,
        options: { repoUrl: `https://github.com/org/repo` },
      }
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20` },
          providerLinks: [],
          gitProviderLinks: [
            { provider: gitProvider, priority: 0, projectId: `proj-1`, branch: null },
          ],
        }),
        error: null,
      })
      mockResolveGitProviderEnv.mockResolvedValue({
        errors: [],
        extraEnv: { TDSK_GIT_0_REPO: `https://github.com/org/repo`, TDSK_GIT_COUNT: `1` },
        placeholders: {},
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      expect(mockResolveGitProviderEnv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            provider: expect.objectContaining({ id: `prov-git`, type: `git` }),
          }),
        ])
      )
    })

    it(`should merge git env vars into pod manifest`, async () => {
      const gitProvider = {
        id: `prov-git`,
        brand: `github`,
        type: `git`,
        secretId: `sec-git`,
        options: { repoUrl: `https://github.com/org/repo`, branch: `develop` },
      }
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20` },
          providerLinks: [],
          gitProviderLinks: [
            {
              provider: gitProvider,
              priority: 0,
              projectId: `proj-1`,
              branch: `develop`,
            },
          ],
        }),
        error: null,
      })
      const gitPlaceholders = { tdsk_ph_git_mock: { secretId: `sec-git` } }
      mockResolveGitProviderEnv.mockResolvedValue({
        errors: [],
        extraEnv: {
          TDSK_GIT_0_REPO: `https://github.com/org/repo`,
          TDSK_GIT_0_BRANCH: `develop`,
          TDSK_GIT_0_BRAND: `github`,
          TDSK_GIT_0_TOKEN: `tdsk_ph_git_mock`,
          TDSK_GIT_COUNT: `1`,
        },
        placeholders: gitPlaceholders,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.extraEnv.TDSK_GIT_0_REPO).toBe(`https://github.com/org/repo`)
      expect(manifestCall.extraEnv.TDSK_GIT_0_BRANCH).toBe(`develop`)
      expect(manifestCall.extraEnv.TDSK_GIT_0_BRAND).toBe(`github`)
      expect(manifestCall.extraEnv.TDSK_GIT_0_TOKEN).toBe(`tdsk_ph_git_mock`)
      expect(manifestCall.extraEnv.TDSK_GIT_COUNT).toBe(`1`)
      expect(manifestCall.placeholders.tdsk_ph_git_mock).toEqual({ secretId: `sec-git` })
    })

    it(`should throw Exception(400) when git provider resolution has errors`, async () => {
      const gitProvider = {
        id: `prov-git`,
        brand: `github`,
        type: `git`,
        options: {},
      }
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20` },
          providerLinks: [],
          gitProviderLinks: [
            { provider: gitProvider, priority: 0, projectId: `proj-1`, branch: null },
          ],
        }),
        error: null,
      })
      mockResolveGitProviderEnv.mockResolvedValue({
        errors: [`Git provider 'github' has no repoUrl configured`],
        extraEnv: {},
        placeholders: {},
      })

      try {
        await svc.startPod(baseOpts as any)
        expect.fail(`Expected startPod to throw`)
      } catch (err) {
        expect(err).toBeInstanceOf(Exception)
        expect((err as any).status).toBe(400)
        expect((err as Error).message).toContain(`Git provider configuration error`)
      }
    })

    it(`should filter git providers by projectId via getGitProviders — only matching project returned`, async () => {
      const gitNoProject = {
        id: `prov-git-org`,
        brand: `github`,
        type: `git`,
        options: { repoUrl: `https://github.com/org/org-repo` },
      }
      const gitProjectMatch = {
        id: `prov-git-proj`,
        brand: `gitlab`,
        type: `git`,
        options: { repoUrl: `https://gitlab.com/org/proj-repo` },
      }
      const gitProjectOther = {
        id: `prov-git-other`,
        brand: `bitbucket`,
        type: `git`,
        options: { repoUrl: `https://bitbucket.org/org/other-repo` },
      }
      const aiGlobal = {
        id: `prov-ai`,
        brand: `anthropic`,
        type: `ai`,
        secretId: `sec-1`,
      }
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code` },
          providerLinks: [{ provider: aiGlobal, priority: 0, model: undefined }],
          gitProviderLinks: [
            {
              provider: gitNoProject,
              priority: 1,
              projectId: `proj-no-match`,
              branch: null,
            },
            {
              provider: gitProjectMatch,
              priority: 2,
              projectId: `proj-1`,
              branch: null,
            },
            {
              provider: gitProjectOther,
              priority: 3,
              projectId: `proj-other`,
              branch: null,
            },
          ],
        }),
        error: null,
      })
      mockResolveProviderEnv.mockResolvedValue({
        errors: [],
        extraEnv: {},
        placeholders: {},
      })
      mockResolveGitProviderEnv.mockResolvedValue({
        errors: [],
        extraEnv: { TDSK_GIT_COUNT: `1` },
        placeholders: {},
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      await svc.startPod(baseOpts as any)

      const gitCall = mockResolveGitProviderEnv.mock.calls[0][0]
      const gitProviderIds = gitCall.map((l: any) => l.provider.id)
      expect(gitProviderIds).toContain(`prov-git-proj`)
      expect(gitProviderIds).not.toContain(`prov-git-org`)
      expect(gitProviderIds).not.toContain(`prov-git-other`)

      expect(mockResolveProviderEnv).toHaveBeenCalled()
      const aiCall = mockResolveProviderEnv.mock.calls[0]
      const aiProviderIds = aiCall[1].map((l: any) => l.provider.id)
      expect(aiProviderIds).toContain(`prov-ai`)
    })

    it(`should create pod without provider env when sandbox has no linked providers`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, providerLinks: [] }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
      kube.createPod.mockResolvedValue({ metadata: { name: `tdsk-sb-test` } })

      const result = await svc.startPod(baseOpts as any)

      expect(result).toBe(`tdsk-sb-test`)
      expect(mockResolveProviderEnv).not.toHaveBeenCalled()
    })

    describe(`docker secret lifecycle`, () => {
      const dockerProvider = {
        id: `prov-d1`,
        brand: `ghcr`,
        type: `docker`,
        secretId: `sec-d1`,
      }
      const sandboxWithDocker = {
        id: `sb-1`,
        config: { image: `node:20` },
        providerLinks: [{ provider: dockerProvider, priority: 0, model: undefined }],
      }

      it(`should create K8s secrets and pass imagePullSecrets to manifest`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockResolvedValue({
          metadata: { name: `tdsk-sb-test`, uid: `pod-uid-1` },
        })
        kube.patchSecretOwnerReferences.mockResolvedValue(undefined)

        await svc.startPod(baseOpts as any)

        expect(kube.createDockerRegistrySecret).toHaveBeenCalledWith(
          expect.stringMatching(/^tdsk-dkr-/),
          `ghcr.io`,
          `user`,
          `pass`
        )
        const manifestCall = mockBuildPodManifest.mock.calls[0][0]
        expect(manifestCall.imagePullSecrets).toBeDefined()
        expect(manifestCall.imagePullSecrets).toHaveLength(1)
        expect(manifestCall.imagePullSecrets[0]).toMatch(/^tdsk-dkr-/)
      })

      it(`should roll back created secrets when createDockerRegistrySecret fails mid-loop`, async () => {
        const twoCredSandbox = {
          ...sandboxWithDocker,
          providerLinks: [
            { provider: dockerProvider, priority: 0, model: undefined },
            {
              provider: { ...dockerProvider, id: `prov-d2` },
              priority: 1,
              model: undefined,
            },
          ],
        }
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(twoCredSandbox),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [
            { registry: `ghcr.io`, username: `u1`, password: `p1` },
            { registry: `docker.io`, username: `u2`, password: `p2` },
          ],
          errors: [],
        })
        kube.createDockerRegistrySecret
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error(`K8s API error`))
        kube.deleteSecret.mockResolvedValue(undefined)

        await expect(svc.startPod(baseOpts as any)).rejects.toThrow(`K8s API error`)

        expect(kube.deleteSecret).toHaveBeenCalledTimes(1)
        expect(kube.deleteSecret).toHaveBeenCalledWith(
          expect.stringMatching(/^tdsk-dkr-/)
        )
      })

      it(`should roll back docker secrets when createPod fails`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockRejectedValue(new Error(`pod quota exceeded`))
        kube.deleteSecret.mockResolvedValue(undefined)

        await expect(svc.startPod(baseOpts as any)).rejects.toThrow(`pod quota exceeded`)

        expect(kube.deleteSecret).toHaveBeenCalledTimes(1)
        expect(kube.deleteSecret).toHaveBeenCalledWith(
          expect.stringMatching(/^tdsk-dkr-/)
        )
      })

      it(`should roll back docker secrets when createPod returns no metadata.name`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockResolvedValue({ metadata: {} })
        kube.deleteSecret.mockResolvedValue(undefined)

        await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
          `Pod created but metadata.name is missing`
        )

        expect(kube.deleteSecret).toHaveBeenCalledTimes(1)
      })

      it(`should store docker secret names in dockerSecrets map`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockResolvedValue({
          metadata: { name: `tdsk-sb-test`, uid: `pod-uid-1` },
        })
        kube.patchSecretOwnerReferences.mockResolvedValue(undefined)

        await svc.startPod(baseOpts as any)

        const stored = (svc as any).dockerSecrets.get(`tdsk-sb-test`)
        expect(stored).toBeDefined()
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatch(/^tdsk-dkr-/)
      })

      it(`should fire patchSecretOwnerReferences after successful pod creation`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockResolvedValue({
          metadata: { name: `tdsk-sb-test`, uid: `pod-uid-1` },
        })
        kube.patchSecretOwnerReferences.mockResolvedValue(undefined)

        await svc.startPod(baseOpts as any)

        await vi.waitFor(() => {
          expect(kube.patchSecretOwnerReferences).toHaveBeenCalledWith(
            expect.stringMatching(/^tdsk-dkr-/),
            expect.arrayContaining([
              expect.objectContaining({
                apiVersion: `v1`,
                kind: `Pod`,
                name: `tdsk-sb-test`,
                uid: `pod-uid-1`,
                blockOwnerDeletion: false,
              }),
            ])
          )
        })
      })

      it(`should log error when patchSecretOwnerReferences fails`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockResolvedValue({
          metadata: { name: `tdsk-sb-test`, uid: `pod-uid-1` },
        })
        kube.patchSecretOwnerReferences.mockRejectedValue(new Error(`forbidden`))

        await svc.startPod(baseOpts as any)

        await vi.waitFor(() => {
          expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to set ownerReference`),
            `forbidden`
          )
        })
      })

      it(`should log error when rollback deleteSecret fails`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockRejectedValue(new Error(`pod quota exceeded`))
        kube.deleteSecret.mockRejectedValue(new Error(`k8s unavailable`))

        await expect(svc.startPod(baseOpts as any)).rejects.toThrow(`pod quota exceeded`)

        await vi.waitFor(() => {
          expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Rollback: failed to delete docker secret`),
            `k8s unavailable`
          )
        })
      })

      it(`should resolve both env vars and docker secrets for mixed AI + docker providers`, async () => {
        const aiProvider = {
          id: `prov-ai`,
          brand: `anthropic`,
          type: `ai`,
          secretId: `sec-ai`,
        }
        const mixedSandbox = {
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code` },
          providerLinks: [
            { provider: aiProvider, priority: 0, model: undefined },
            { provider: dockerProvider, priority: 1, model: undefined },
          ],
        }
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(mixedSandbox),
          error: null,
        })
        mockResolveProviderEnv.mockResolvedValue({
          extraEnv: { ANTHROPIC_API_KEY: `tdsk_ph_mock` },
          placeholders: { tdsk_ph_mock: { secretId: `sec-ai` } },
          errors: [],
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [{ registry: `ghcr.io`, username: `user`, password: `pass` }],
          errors: [],
        })
        kube.createDockerRegistrySecret.mockResolvedValue(undefined)
        mockBuildPodManifest.mockReturnValue({ metadata: { name: `tdsk-sb-test` } })
        kube.createPod.mockResolvedValue({
          metadata: { name: `tdsk-sb-test`, uid: `pod-uid-1` },
        })
        kube.patchSecretOwnerReferences.mockResolvedValue(undefined)

        await svc.startPod(baseOpts as any)

        expect(mockResolveProviderEnv).toHaveBeenCalled()
        expect(mockResolveDockerPullSecrets).toHaveBeenCalled()
        expect(kube.createDockerRegistrySecret).toHaveBeenCalled()

        const manifestCall = mockBuildPodManifest.mock.calls[0][0]
        expect(manifestCall.extraEnv.ANTHROPIC_API_KEY).toBe(`tdsk_ph_mock`)
        expect(manifestCall.imagePullSecrets).toHaveLength(1)
      })

      it(`should throw Exception(400) when docker resolution has errors`, async () => {
        db.services.sandbox.get.mockResolvedValue({
          data: sbx(sandboxWithDocker),
          error: null,
        })
        mockResolveDockerPullSecrets.mockResolvedValue({
          credentials: [],
          errors: [`Docker provider missing secret`],
        })

        try {
          await svc.startPod(baseOpts as any)
          expect.fail(`Expected startPod to throw`)
        } catch (err) {
          expect(err).toBeInstanceOf(Exception)
          expect((err as any).status).toBe(400)
          expect((err as Error).message).toContain(`Docker registry configuration error`)
        }
      })
    })
  })

  describe(`cleanupInstance`, () => {
    it(`should delete docker secrets for the given instanceId`, async () => {
      const secretNames = [`tdsk-dkr-test-0`, `tdsk-dkr-test-1`]
      ;(svc as any).dockerSecrets.set(`pod-a`, secretNames)
      kube.deleteSecret.mockResolvedValue(undefined)

      svc.cleanupInstance(`pod-a`)

      await vi.waitFor(() => {
        expect(kube.deleteSecret).toHaveBeenCalledTimes(2)
        expect(kube.deleteSecret).toHaveBeenCalledWith(`tdsk-dkr-test-0`)
        expect(kube.deleteSecret).toHaveBeenCalledWith(`tdsk-dkr-test-1`)
      })
    })

    it(`should log error when docker secret deletion fails`, async () => {
      ;(svc as any).dockerSecrets.set(`pod-a`, [`tdsk-dkr-fail-0`])
      kube.deleteSecret.mockRejectedValue(new Error(`forbidden`))

      svc.cleanupInstance(`pod-a`)

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(`Failed to delete docker secret tdsk-dkr-fail-0`),
          `forbidden`
        )
      })
    })

    it(`should remove docker secrets entry from map after cleanup`, async () => {
      ;(svc as any).dockerSecrets.set(`pod-a`, [`tdsk-dkr-test-0`])
      kube.deleteSecret.mockResolvedValue(undefined)

      svc.cleanupInstance(`pod-a`)

      await vi.waitFor(() => {
        expect((svc as any).dockerSecrets.has(`pod-a`)).toBe(false)
      })
    })

    it(`should not call deleteSecret when instance has no docker secrets`, () => {
      svc.cleanupInstance(`pod-no-secrets`)
      expect(kube.deleteSecret).not.toHaveBeenCalled()
    })
  })

  describe(`getPassword`, () => {
    it(`should return the cached password for a known instance`, () => {
      ;(svc as any).passwords.set(`pod-a`, `secret-pw-123`)

      expect(svc.getPassword(`pod-a`)).toBe(`secret-pw-123`)
    })

    it(`should return undefined for an unknown instance`, () => {
      expect(svc.getPassword(`pod-unknown`)).toBeUndefined()
    })

    it(`should return undefined after the instance is cleaned up`, () => {
      ;(svc as any).passwords.set(`pod-a`, `secret-pw-123`)
      svc.cleanupInstance(`pod-a`)

      expect(svc.getPassword(`pod-a`)).toBeUndefined()
    })
  })

  describe(`recoverPassword`, () => {
    it(`should return the cached password without calling kube when already cached`, async () => {
      ;(svc as any).passwords.set(`pod-a`, `cached-pw`)

      const result = await svc.recoverPassword(`pod-a`)

      expect(result).toBe(`cached-pw`)
      expect(kube.runInPod).not.toHaveBeenCalled()
    })

    it(`should recover password from pod env when not cached`, async () => {
      kube.runInPod.mockResolvedValue({ success: true, output: `recovered-pw\n` })

      const result = await svc.recoverPassword(`pod-a`)

      expect(result).toBe(`recovered-pw`)
      expect(kube.runInPod).toHaveBeenCalledWith(`pod-a`, [
        `printenv`,
        `TDSK_SSH_PASSWORD`,
      ])
    })

    it(`should cache the recovered password for subsequent calls`, async () => {
      kube.runInPod.mockResolvedValue({ success: true, output: `recovered-pw\n` })

      await svc.recoverPassword(`pod-a`)

      expect(svc.getPassword(`pod-a`)).toBe(`recovered-pw`)
    })

    it(`should return undefined when runInPod returns empty password`, async () => {
      kube.runInPod.mockResolvedValue({ success: true, output: `  \n` })

      const result = await svc.recoverPassword(`pod-a`)

      expect(result).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`TDSK_SSH_PASSWORD is empty`)
      )
    })

    it(`should return undefined when runInPod returns non-success`, async () => {
      kube.runInPod.mockResolvedValue({ success: false, error: `command failed` })

      const result = await svc.recoverPassword(`pod-a`)

      expect(result).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`printenv returned non-success`),
        `command failed`
      )
    })

    it(`should return undefined when runInPod returns success but no output`, async () => {
      kube.runInPod.mockResolvedValue({ success: true, output: `` })

      const result = await svc.recoverPassword(`pod-a`)

      expect(result).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`printenv returned non-success`),
        `no output`
      )
    })

    it(`should return undefined and log warning when runInPod throws`, async () => {
      kube.runInPod.mockRejectedValue(new Error(`pod not found`))

      const result = await svc.recoverPassword(`pod-a`)

      expect(result).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to recover password`),
        `pod not found`
      )
    })
  })

  describe(`getInstanceSessions`, () => {
    it(`should return sessions matching the sandboxId across multiple instances`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      svc.addSession(`pod-b`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-b`,
        sandboxId: `sb-1`,
        sessionId: `sess-2`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      const result = svc.getInstanceSessions(`sb-1`)

      expect(result.size).toBe(2)
      expect(result.get(`pod-a`)).toHaveLength(1)
      expect(result.get(`pod-a`)![0].sessionId).toBe(`sess-1`)
      expect(result.get(`pod-b`)).toHaveLength(1)
      expect(result.get(`pod-b`)![0].sessionId).toBe(`sess-2`)
    })

    it(`should exclude sessions for other sandboxes`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-2`,
        sessionId: `sess-2`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      const result = svc.getInstanceSessions(`sb-1`)

      expect(result.size).toBe(1)
      expect(result.get(`pod-a`)).toHaveLength(1)
      expect(result.get(`pod-a`)![0].sessionId).toBe(`sess-1`)
    })

    it(`should return an empty map when no sessions match the sandboxId`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-other`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      const result = svc.getInstanceSessions(`sb-1`)

      expect(result.size).toBe(0)
    })

    it(`should return an empty map when no sessions exist at all`, () => {
      const result = svc.getInstanceSessions(`sb-1`)

      expect(result.size).toBe(0)
    })

    it(`should not include instances where all sessions belong to other sandboxes`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-2`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      svc.addSession(`pod-b`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-b`,
        sandboxId: `sb-1`,
        sessionId: `sess-2`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      const result = svc.getInstanceSessions(`sb-1`)

      expect(result.size).toBe(1)
      expect(result.has(`pod-a`)).toBe(false)
      expect(result.has(`pod-b`)).toBe(true)
    })
  })

  describe(`findInstanceForSession`, () => {
    it(`should return instanceId when session exists on that instance`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      expect(svc.findInstanceForSession(`sess-1`, `sb-1`)).toBe(`pod-a`)
    })

    it(`should return undefined when sessionId exists but sandboxId does not match`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      expect(svc.findInstanceForSession(`sess-1`, `sb-other`)).toBeUndefined()
    })

    it(`should return undefined when sessionId does not exist`, () => {
      expect(svc.findInstanceForSession(`nonexistent`, `sb-1`)).toBeUndefined()
    })

    it(`should find the correct instance across multiple instances`, () => {
      svc.addSession(`pod-a`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-a`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      svc.addSession(`pod-b`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-b`,
        sandboxId: `sb-1`,
        sessionId: `sess-2`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      expect(svc.findInstanceForSession(`sess-1`, `sb-1`)).toBe(`pod-a`)
      expect(svc.findInstanceForSession(`sess-2`, `sb-1`)).toBe(`pod-b`)
    })
  })

  describe(`idle timeout`, () => {
    it(`should stop pods seeded via updateActivity after timeout expires`, async () => {
      kube.deletePod.mockResolvedValue(undefined)
      kube.getPod.mockResolvedValue({
        metadata: { labels: { [`tdsk.app/sandbox-id`]: `sb-1` } },
      })
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ config: { idleTimeoutMinutes: 0.001 } }),
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

    it(`should use project-scoped idleTimeoutMinutes from effective config`, async () => {
      kube.deletePod.mockResolvedValue(undefined)
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: {
            [`tdsk.app/sandbox-id`]: `sb-1`,
            [`tdsk.app/project-id`]: `proj-1`,
          },
        },
      })
      const mockSandbox = {
        config: { idleTimeoutMinutes: 60 },
        getEffectiveConfig: vi.fn().mockReturnValue({
          config: { idleTimeoutMinutes: 0.001 },
        }),
        getProjectAlias() {
          return undefined
        },
        getProjectConfig() {
          return undefined
        },
      }
      db.services.sandbox.get.mockResolvedValue({ data: mockSandbox, error: null })

      svc.updateActivity(`project-pod`)

      const original = svc[`config`] as Record<string, any>
      Object.defineProperty(svc, `config`, {
        value: { ...original, idleInterval: 50 },
        writable: true,
      })
      svc.startIdleTimeout()

      await new Promise((resolve) => setTimeout(resolve, 200))
      svc.stopIdleTimeout()

      expect(mockSandbox.getEffectiveConfig).toHaveBeenCalledWith(`proj-1`)
      expect(kube.deletePod).toHaveBeenCalledWith(`project-pod`, 30)
    })

    it(`should never reap pods whose effective config has resident set`, async () => {
      kube.deletePod.mockResolvedValue(undefined)
      kube.getPod.mockResolvedValue({
        metadata: {
          labels: {
            [`tdsk.app/sandbox-id`]: `sb-1`,
            [`tdsk.app/project-id`]: `proj-1`,
          },
        },
      })
      const mockSandbox = {
        config: { idleTimeoutMinutes: 0.001 },
        getEffectiveConfig: vi.fn().mockReturnValue({
          // Resident pods are long-lived — even a tiny idle timeout must be
          // ignored when the effective config carries `resident`.
          config: { idleTimeoutMinutes: 0.001, resident: { agentId: `ag_agent001` } },
        }),
        getProjectAlias() {
          return undefined
        },
        getProjectConfig() {
          return undefined
        },
      }
      db.services.sandbox.get.mockResolvedValue({ data: mockSandbox, error: null })

      svc.updateActivity(`resident-pod`)

      const original = svc[`config`] as Record<string, any>
      Object.defineProperty(svc, `config`, {
        value: { ...original, idleInterval: 50, timeoutMin: 0 },
        writable: true,
      })
      svc.startIdleTimeout()

      await new Promise((resolve) => setTimeout(resolve, 200))
      svc.stopIdleTimeout()

      expect(mockSandbox.getEffectiveConfig).toHaveBeenCalledWith(`proj-1`)
      expect(kube.deletePod).not.toHaveBeenCalled()
    })

    it(`should cleanup pod tracking when getPod returns 404 via statusCode`, async () => {
      const kubeError = Object.assign(new Error(`Not Found`), { statusCode: 404 })
      kube.getPod.mockRejectedValue(kubeError)
      kube.deletePod.mockResolvedValue(undefined)
      kube.deleteSecret.mockResolvedValue(undefined)

      svc.updateActivity(`gone-pod`)

      const original = svc[`config`] as Record<string, any>
      Object.defineProperty(svc, `config`, {
        value: { ...original, idleInterval: 50, timeoutMin: 0 },
        writable: true,
      })
      svc.startIdleTimeout()

      await new Promise((resolve) => setTimeout(resolve, 200))
      svc.stopIdleTimeout()

      expect(kube.deletePod).not.toHaveBeenCalled()
      expect((svc as any).instanceActivity.has(`gone-pod`)).toBe(false)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`gone-pod no longer exists`)
      )
    })

    it(`should cleanup pod tracking when getPod returns 404 via code`, async () => {
      const kubeError = Object.assign(new Error(`Not Found`), { code: 404 })
      kube.getPod.mockRejectedValue(kubeError)
      kube.deletePod.mockResolvedValue(undefined)
      kube.deleteSecret.mockResolvedValue(undefined)

      svc.updateActivity(`gone-pod-2`)

      const original = svc[`config`] as Record<string, any>
      Object.defineProperty(svc, `config`, {
        value: { ...original, idleInterval: 50, timeoutMin: 0 },
        writable: true,
      })
      svc.startIdleTimeout()

      await new Promise((resolve) => setTimeout(resolve, 200))
      svc.stopIdleTimeout()

      expect(kube.deletePod).not.toHaveBeenCalled()
      expect((svc as any).instanceActivity.has(`gone-pod-2`)).toBe(false)
    })

    it(`should not stop pods that have active sessions`, async () => {
      kube.deletePod.mockResolvedValue(undefined)

      svc.updateActivity(`active-pod`)
      svc.addSession(`active-pod`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `active-pod`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
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

  describe(`findRunningInstance`, () => {
    it(`should return instanceId for Running pod matching by name`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          },
          status: { phase: `Running` },
        },
      ])

      const result = await svc.findRunningInstance(`tdsk-sb-test-aaaa`, `org-1`)

      expect(result).toBe(`tdsk-sb-test-aaaa`)
    })

    it(`should return undefined for pod with deletionTimestamp`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
            deletionTimestamp: new Date().toISOString(),
          },
          status: { phase: `Running` },
        },
      ])

      const result = await svc.findRunningInstance(`tdsk-sb-test-aaaa`, `org-1`)

      expect(result).toBeUndefined()
    })

    it(`should return undefined when instanceId does not match`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          },
          status: { phase: `Running` },
        },
      ])

      const result = await svc.findRunningInstance(`tdsk-sb-test-other`, `org-1`)

      expect(result).toBeUndefined()
    })
  })

  describe(`findActiveInstance`, () => {
    it(`should return instanceId for Running pod matching by name`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          },
          status: { phase: `Running` },
        },
      ])

      const result = await svc.findActiveInstance(`tdsk-sb-test-aaaa`, `org-1`)

      expect(result).toBe(`tdsk-sb-test-aaaa`)
    })

    it(`should return instanceId for Pending pod matching by name`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
          },
          status: { phase: `Pending` },
        },
      ])

      const result = await svc.findActiveInstance(`tdsk-sb-test-aaaa`, `org-1`)

      expect(result).toBe(`tdsk-sb-test-aaaa`)
    })

    it(`should return undefined for Running pod with deletionTimestamp`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
            deletionTimestamp: new Date().toISOString(),
          },
          status: { phase: `Running` },
        },
      ])

      const result = await svc.findActiveInstance(`tdsk-sb-test-aaaa`, `org-1`)

      expect(result).toBeUndefined()
    })

    it(`should return undefined for Pending pod with deletionTimestamp`, async () => {
      kube.listPods.mockResolvedValue([
        {
          metadata: {
            name: `tdsk-sb-test-aaaa`,
            labels: { [`tdsk.app/sandbox-id`]: `sb-1` },
            deletionTimestamp: new Date().toISOString(),
          },
          status: { phase: `Pending` },
        },
      ])

      const result = await svc.findActiveInstance(`tdsk-sb-test-aaaa`, `org-1`)

      expect(result).toBeUndefined()
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

    it(`should return Terminating when pod has deletionTimestamp set`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { deletionTimestamp: new Date().toISOString() },
        status: { phase: `Running` },
      })

      const result = await svc.getPodState(`pod-a`)

      expect(result).toBe(EContainerState.Terminating)
      expect(mockToContainerState).not.toHaveBeenCalled()
    })
  })

  describe(`getPodConditionSummary`, () => {
    it(`should summarize not-ready conditions with reason and message`, async () => {
      kube.getPod.mockResolvedValue({
        status: {
          conditions: [
            {
              type: `PodScheduled`,
              status: `False`,
              reason: `Unschedulable`,
              message: `0/3 nodes are available: insufficient cpu`,
            },
          ],
        },
      })

      const result = await svc.getPodConditionSummary(`pod-a`)

      expect(result).toBe(
        `PodScheduled=False (Unschedulable): 0/3 nodes are available: insufficient cpu`
      )
    })

    it(`should join multiple not-ready conditions with a semicolon`, async () => {
      kube.getPod.mockResolvedValue({
        status: {
          conditions: [
            { type: `PodScheduled`, status: `True` },
            { type: `Ready`, status: `False`, reason: `ContainersNotReady` },
          ],
        },
      })

      const result = await svc.getPodConditionSummary(`pod-a`)

      expect(result).toBe(`Ready=False (ContainersNotReady)`)
    })

    it(`should return undefined when all conditions are True`, async () => {
      kube.getPod.mockResolvedValue({
        status: { conditions: [{ type: `PodScheduled`, status: `True` }] },
      })

      const result = await svc.getPodConditionSummary(`pod-a`)

      expect(result).toBeUndefined()
    })

    it(`should return undefined when the pod has no conditions`, async () => {
      kube.getPod.mockResolvedValue({ status: {} })

      const result = await svc.getPodConditionSummary(`pod-a`)

      expect(result).toBeUndefined()
    })

    it(`should warn and return undefined when the fetch fails`, async () => {
      kube.getPod.mockRejectedValue(new Error(`api server unreachable`))

      const result = await svc.getPodConditionSummary(`pod-a`)

      expect(result).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to fetch pod conditions for pod-a`),
        `api server unreachable`
      )
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

    it(`should throw when pod is Terminating`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { deletionTimestamp: new Date().toISOString() },
        status: { phase: `Running` },
      })

      await expect(svc.getSandbox(`pod-a`)).rejects.toThrow(
        `Pod pod-a is not running (state: Terminating)`
      )
    })
  })

  describe(`waitForPodReady`, () => {
    const cloneReadyCmd = `[ -f /workspace/.tdsk-workspace-ready ]`

    it(`should resolve once the pod transitions Pending → Running`, async () => {
      vi.useFakeTimers()
      try {
        mockToContainerState.mockImplementation((phase: string) => phase)
        kube.getPod
          .mockResolvedValueOnce({ status: { phase: `Pending` } })
          .mockResolvedValueOnce({ status: { phase: `Pending` } })
          .mockResolvedValue({ status: { phase: `Running` } })

        const promise = svc.waitForPodReady(`pod-a`)
        await vi.advanceTimersByTimeAsync(4000)

        await expect(promise).resolves.toBeUndefined()
        expect(kube.getPod).toHaveBeenCalledTimes(3)
        expect(MockKubeSandboxInstance.exec).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it(`should throw when the pod never leaves Pending before the timeout`, async () => {
      vi.useFakeTimers()
      try {
        mockToContainerState.mockReturnValue(EContainerState.Pending)
        kube.getPod.mockResolvedValue({ status: { phase: `Pending` } })

        const promise = svc.waitForPodReady(`pod-a`, { timeoutMs: 10_000 })
        const rejection = expect(promise).rejects.toThrow(
          `Timed out after 10s waiting for pod pod-a to be ready (state: Pending)`
        )
        await vi.advanceTimersByTimeAsync(12_000)
        await rejection
      } finally {
        vi.useRealTimers()
      }
    })

    it(`should throw immediately when the pod is Failed`, async () => {
      mockToContainerState.mockReturnValue(EContainerState.Failed)
      kube.getPod.mockResolvedValue({ status: { phase: `Failed` } })

      await expect(svc.waitForPodReady(`pod-a`)).rejects.toThrow(
        `Pod pod-a will never become ready (state: Failed)`
      )
      // getPodState + the condition-summary fetch on the throw path
      expect(kube.getPod).toHaveBeenCalledTimes(2)
    })

    it(`should throw immediately when the pod is Succeeded`, async () => {
      mockToContainerState.mockReturnValue(EContainerState.Succeeded)
      kube.getPod.mockResolvedValue({ status: { phase: `Succeeded` } })

      await expect(svc.waitForPodReady(`pod-a`)).rejects.toThrow(
        `Pod pod-a will never become ready (state: Succeeded)`
      )
      expect(kube.getPod).toHaveBeenCalledTimes(2)
    })

    it(`should throw immediately when the pod is Terminating`, async () => {
      kube.getPod.mockResolvedValue({
        metadata: { deletionTimestamp: new Date().toISOString() },
        status: { phase: `Running` },
      })

      await expect(svc.waitForPodReady(`pod-a`)).rejects.toThrow(
        `Pod pod-a will never become ready (state: Terminating)`
      )
      expect(kube.getPod).toHaveBeenCalledTimes(2)
    })

    it(`should append the pod condition summary to the terminal-state error when available`, async () => {
      mockToContainerState.mockReturnValue(EContainerState.Failed)
      kube.getPod.mockResolvedValue({
        status: {
          phase: `Failed`,
          conditions: [
            {
              type: `PodScheduled`,
              status: `False`,
              reason: `Unschedulable`,
              message: `0/3 nodes are available`,
            },
          ],
        },
      })

      await expect(svc.waitForPodReady(`pod-a`)).rejects.toThrow(
        `Pod pod-a will never become ready (state: Failed) — conditions: PodScheduled=False (Unschedulable): 0/3 nodes are available`
      )
    })

    it(`should append the pod condition summary to the timeout error when available`, async () => {
      vi.useFakeTimers()
      try {
        mockToContainerState.mockReturnValue(EContainerState.Pending)
        kube.getPod.mockResolvedValue({
          status: {
            phase: `Pending`,
            conditions: [
              { type: `PodScheduled`, status: `False`, reason: `Unschedulable` },
            ],
          },
        })

        const promise = svc.waitForPodReady(`pod-a`, { timeoutMs: 10_000 })
        const rejection = expect(promise).rejects.toThrow(
          `Timed out after 10s waiting for pod pod-a to be ready (state: Pending) — conditions: PodScheduled=False (Unschedulable)`
        )
        await vi.advanceTimersByTimeAsync(12_000)
        await rejection
      } finally {
        vi.useRealTimers()
      }
    })

    it(`should poll the in-pod clone check until success when cloneCheck is set`, async () => {
      vi.useFakeTimers()
      try {
        mockToContainerState.mockReturnValue(EContainerState.Running)
        kube.getPod.mockResolvedValue({ status: { phase: `Running` } })
        MockKubeSandboxInstance.exec
          .mockResolvedValueOnce({ success: false, output: `` })
          .mockRejectedValueOnce(new Error(`exec transport hiccup`))
          .mockResolvedValue({ success: true, output: `` })

        const promise = svc.waitForPodReady(`pod-a`, { cloneCheck: true })
        await vi.advanceTimersByTimeAsync(4000)

        await expect(promise).resolves.toBeUndefined()
        expect(MockKubeSandboxInstance.exec).toHaveBeenCalledTimes(3)
        expect(MockKubeSandboxInstance.exec).toHaveBeenCalledWith(cloneReadyCmd)
        // The exec rejection was swallowed as not-ready, never fatal
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(`Clone readiness check errored for pod pod-a`),
          `exec transport hiccup`
        )
      } finally {
        vi.useRealTimers()
      }
    })

    it(`should warn and resolve when the clone check never succeeds before the deadline`, async () => {
      vi.useFakeTimers()
      try {
        mockToContainerState.mockReturnValue(EContainerState.Running)
        kube.getPod.mockResolvedValue({ status: { phase: `Running` } })
        MockKubeSandboxInstance.exec.mockResolvedValue({ success: false, output: `` })

        const promise = svc.waitForPodReady(`pod-a`, {
          cloneCheck: true,
          timeoutMs: 6000,
        })
        await vi.advanceTimersByTimeAsync(8000)

        await expect(promise).resolves.toBeUndefined()
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(`Timed out waiting for git clone(s) in pod pod-a`)
        )
      } finally {
        vi.useRealTimers()
      }
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
          timeout: SandboxProxyTimeoutMs,
          proxyTimeout: SandboxProxyTimeoutMs,
        })
      )
      expect(SandboxService.proxyMap.get(`http://10.0.0.1:3000`)).toBe(mockProxy)
    })

    it(`getPodProxy should set a timeout and proxyTimeout to prevent hung-connection exhaustion`, () => {
      const mockProxy = vi.fn()
      mockCreateProxyMiddleware.mockReturnValue(mockProxy)
      SandboxService.proxyMap.clear()

      SandboxService.getPodProxy(`http://10.0.0.1:5000`)

      const callArgs = mockCreateProxyMiddleware.mock.calls[0][0]
      expect(callArgs.timeout).toBe(SandboxProxyTimeoutMs)
      expect(callArgs.proxyTimeout).toBe(SandboxProxyTimeoutMs)
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

  describe(`buildPortUrl / buildPortUrlTemplate`, () => {
    it(`should use the configured domain in buildPortUrl`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any, {
        domain: `sandbox.dev.threadedstack.app`,
      })
      expect(svc.buildPortUrl(`sb-abc123`, 3000)).toBe(
        `https://3000--sb-abc123.sandbox.dev.threadedstack.app`
      )
    })

    it(`should use the configured domain in buildPortUrlTemplate`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any, {
        domain: `sandbox.local.threadedstack.app`,
      })
      expect(svc.buildPortUrlTemplate(`sb-abc123`)).toBe(
        `https://{port}--sb-abc123.sandbox.local.threadedstack.app`
      )
    })

    it(`should handle production domain`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any, {
        domain: `sandbox.threadedstack.app`,
      })
      expect(svc.buildPortUrl(`sb-deadbeef`, 8080)).toBe(
        `https://8080--sb-deadbeef.sandbox.threadedstack.app`
      )
    })
  })

  describe(`shell session queries`, () => {
    it(`getShellSessionsForSandbox returns sessions matching sandboxId`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)

      const session1 = {
        sessionId: `s1`,
        sandboxId: `sb_aaa`,
        orgId: `org1`,
        userId: `u1`,
        sandboxSessionId: `sn_t1`,
        stdout: {} as any,
        stdin: {} as any,
        closeExec: vi.fn(),
        resize: vi.fn(),
        buffer: { clear: vi.fn() } as any,
        attachments: new Set() as any,
        ttlTimer: null,
        lastRunningToolCall: null,
        visibility: ESandboxSessionVisibility.private,
      }
      const session2 = {
        ...session1,
        sessionId: `s2`,
        sandboxId: `sb_bbb`,
      }
      const session3 = {
        ...session1,
        sessionId: `s3`,
        sandboxId: `sb_aaa`,
      }

      svc.addShellSession(session1)
      svc.addShellSession(session2)
      svc.addShellSession(session3)

      const result = svc.getShellSessionsForSandbox(`sb_aaa`)
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.sessionId).sort()).toEqual([`s1`, `s3`])
    })

    it(`getOrgShellSessionCount counts sessions for org`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)

      const base = {
        sandboxId: `sb_aaa`,
        userId: `u1`,
        sandboxSessionId: `sn_t1`,
        stdout: {} as any,
        stdin: {} as any,
        closeExec: vi.fn(),
        resize: vi.fn(),
        buffer: { clear: vi.fn() } as any,
        attachments: new Set() as any,
        ttlTimer: null,
        lastRunningToolCall: null,
        visibility: ESandboxSessionVisibility.private,
      }

      svc.addShellSession({ ...base, sessionId: `s1`, orgId: `org1` })
      svc.addShellSession({ ...base, sessionId: `s2`, orgId: `org1` })
      svc.addShellSession({ ...base, sessionId: `s3`, orgId: `org2` })

      expect(svc.getOrgShellSessionCount(`org1`)).toBe(2)
      expect(svc.getOrgShellSessionCount(`org2`)).toBe(1)
      expect(svc.getOrgShellSessionCount(`org3`)).toBe(0)
    })

    it(`updateSessionVisibility updates both shell and pod session maps`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)

      const shell = {
        sessionId: `s1`,
        sandboxId: `sb_aaa`,
        orgId: `org1`,
        userId: `u1`,
        sandboxSessionId: `sn_t1`,
        stdout: {} as any,
        stdin: {} as any,
        closeExec: vi.fn(),
        resize: vi.fn(),
        buffer: { clear: vi.fn() } as any,
        attachments: new Set() as any,
        ttlTimer: null,
        lastRunningToolCall: null,
        visibility: ESandboxSessionVisibility.private,
      }
      svc.addShellSession(shell)
      svc.addSession(`pod1`, {
        orgId: `org1`,
        userId: `u1`,
        instanceId: `pod1`,
        sandboxId: `sb_aaa`,
        sessionId: `s1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      const updated = svc.updateSessionVisibility(`s1`, ESandboxSessionVisibility.public)
      expect(updated).toBe(true)

      const shellSession = svc.getShellSession(`s1`)
      expect(shellSession?.visibility).toBe(`public`)

      const podSessions = svc.getSessions(`pod1`)
      expect(podSessions[0].visibility).toBe(`public`)
    })

    it(`updateSessionVisibility returns false for unknown session`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)
      expect(
        svc.updateSessionVisibility(`nonexistent`, ESandboxSessionVisibility.public)
      ).toBe(false)
    })

    it(`removeShellSession calls closeExec and clears state`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)

      const closeExec = vi.fn()
      const session = {
        sessionId: `s1`,
        sandboxId: `sb_aaa`,
        orgId: `org1`,
        userId: `u1`,
        sandboxSessionId: `sn_t1`,
        stdout: {} as any,
        stdin: {} as any,
        closeExec,
        resize: vi.fn(),
        buffer: { clear: vi.fn() } as any,
        attachments: new Set([{ readyState: 1, send: vi.fn() }]) as any,
        ttlTimer: setTimeout(() => {}, 99999),
        lastRunningToolCall: null,
        visibility: ESandboxSessionVisibility.private,
      }

      svc.addShellSession(session)
      expect(svc.getShellSession(`s1`)).toBeDefined()

      svc.removeShellSession(`s1`)

      expect(closeExec).toHaveBeenCalledOnce()
      expect(session.buffer.clear).toHaveBeenCalled()
      expect(session.attachments.size).toBe(0)
      expect(svc.getShellSession(`s1`)).toBeUndefined()
    })

    it(`removeShellSession continues cleanup when closeExec throws`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)

      const closeExec = vi.fn(() => {
        throw new Error(`already closed`)
      })
      const session = {
        sessionId: `s1`,
        sandboxId: `sb_aaa`,
        orgId: `org1`,
        userId: `u1`,
        sandboxSessionId: `sn_t1`,
        stdout: {} as any,
        stdin: {} as any,
        closeExec,
        resize: vi.fn(),
        buffer: { clear: vi.fn() } as any,
        attachments: new Set() as any,
        ttlTimer: null,
        lastRunningToolCall: null,
        visibility: ESandboxSessionVisibility.private,
      }

      svc.addShellSession(session)
      svc.removeShellSession(`s1`)

      expect(closeExec).toHaveBeenCalledOnce()
      expect(session.buffer.clear).toHaveBeenCalled()
      expect(svc.getShellSession(`s1`)).toBeUndefined()
    })

    it(`removeShellSession is a no-op for unknown session`, () => {
      const kube = makeKube()
      const svc = new SandboxService(kube as any, makeDb() as any)
      expect(() => svc.removeShellSession(`nonexistent`)).not.toThrow()
    })
  })

  describe(`startPod > skills integration`, () => {
    const baseOpts = {
      orgId: `org-1`,
      userId: `user-1`,
      sandboxId: `sb-1`,
      projectId: `proj-1`,
      egressOpts: { enabled: false },
    }

    const setupSandbox = (extra: Record<string, any> = {}) => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({
          id: `sb-1`,
          config: { image: `node:20`, runtime: `claude-code`, ...extra.config },
          providerLinks: [],
          ...extra,
        }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `test-pod` } })
      kube.createPod.mockResolvedValue({
        metadata: { name: `test-pod`, uid: `pod-uid-123` },
      })
      kube.createConfigMap.mockResolvedValue(undefined)
      kube.patchConfigMapOwnerReferences.mockResolvedValue(undefined)
    }

    it(`listSkillsForSandbox returns error — rolls back and throws`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: null,
        error: new Error(`db failure`),
      })

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `Failed to load skill configuration`
      )
    })

    it(`listSkillsForSandbox returns empty array — no ConfigMap created`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [],
        error: null,
      })

      await svc.startPod(baseOpts as any)

      expect(kube.createConfigMap).not.toHaveBeenCalled()
      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.skillsVolume).toBeUndefined()
    })

    it(`skills returned but sandbox has no runtime — resolveSkillFiles not called`, async () => {
      db.services.sandbox.get.mockResolvedValue({
        data: sbx({ id: `sb-1`, config: { image: `node:20` }, providerLinks: [] }),
        error: null,
      })
      mockBuildPodManifest.mockReturnValue({ metadata: { name: `test-pod` } })
      kube.createPod.mockResolvedValue({
        metadata: { name: `test-pod`, uid: `pod-uid-123` },
      })
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })

      await svc.startPod(baseOpts as any)

      expect(mockResolveSkillFiles).not.toHaveBeenCalled()
      expect(kube.createConfigMap).not.toHaveBeenCalled()
    })

    it(`resolveSkillFiles returns null — no ConfigMap created`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })
      mockResolveSkillFiles.mockReturnValue(null)

      await svc.startPod(baseOpts as any)

      expect(kube.createConfigMap).not.toHaveBeenCalled()
    })

    it(`resolveSkillFiles returns resolution — ConfigMap created and skillsVolume passed`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })
      mockResolveSkillFiles.mockReturnValue({
        configMapData: { 'skill-test': `Do X` },
        mountPath: `${SandboxHomePath}/.claude/skills`,
        files: [{ key: `skill-test`, path: `test/SKILL.md` }],
      })

      await svc.startPod(baseOpts as any)

      expect(kube.createConfigMap).toHaveBeenCalledWith(
        expect.stringMatching(/^tdsk-skills-/),
        { 'skill-test': `Do X` }
      )
      const manifestCall = mockBuildPodManifest.mock.calls[0][0]
      expect(manifestCall.skillsVolume).toBeDefined()
      expect(manifestCall.skillsVolume.configMapName).toMatch(/^tdsk-skills-/)
      expect(manifestCall.skillsVolume.mountPath).toBe(
        `${SandboxHomePath}/.claude/skills`
      )
      expect(manifestCall.skillsVolume.files).toEqual([
        { key: `skill-test`, path: `test/SKILL.md` },
      ])
    })

    it(`createConfigMap throws — rolls back docker secrets and re-throws`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })
      mockResolveSkillFiles.mockReturnValue({
        configMapData: { 'skill-test': `Do X` },
        mountPath: `${SandboxHomePath}/.claude/skills`,
        files: [],
      })
      kube.createConfigMap.mockRejectedValue(new Error(`configmap creation failed`))

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(
        `configmap creation failed`
      )
    })

    it(`createPod fails after ConfigMap — deleteConfigMap called`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })
      mockResolveSkillFiles.mockReturnValue({
        configMapData: { 'skill-test': `Do X` },
        mountPath: `${SandboxHomePath}/.claude/skills`,
        files: [],
      })
      kube.createConfigMap.mockResolvedValue(undefined)
      kube.createPod.mockRejectedValue(new Error(`pod quota exceeded`))
      kube.deleteConfigMap.mockResolvedValue(undefined)

      await expect(svc.startPod(baseOpts as any)).rejects.toThrow(`pod quota exceeded`)

      await vi.waitFor(() => {
        expect(kube.deleteConfigMap).toHaveBeenCalledWith(
          expect.stringMatching(/^tdsk-skills-/)
        )
      })
    })

    it(`Pod created with UID — patchConfigMapOwnerReferences called`, async () => {
      setupSandbox()
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })
      mockResolveSkillFiles.mockReturnValue({
        configMapData: { 'skill-test': `Do X` },
        mountPath: `${SandboxHomePath}/.claude/skills`,
        files: [],
      })

      await svc.startPod(baseOpts as any)

      await vi.waitFor(() => {
        expect(kube.patchConfigMapOwnerReferences).toHaveBeenCalledWith(
          expect.stringMatching(/^tdsk-skills-/),
          expect.arrayContaining([
            expect.objectContaining({ kind: `Pod`, uid: `pod-uid-123` }),
          ])
        )
      })
    })

    it(`Pod created without UID — patchConfigMapOwnerReferences NOT called, warning logged`, async () => {
      setupSandbox()
      kube.createPod.mockResolvedValue({ metadata: { name: `test-pod` } })
      db.services.sandbox.listSkillsForSandbox.mockResolvedValue({
        data: [{ id: `skill-1`, name: `test skill` }],
        error: null,
      })
      mockResolveSkillFiles.mockReturnValue({
        configMapData: { 'skill-test': `Do X` },
        mountPath: `${SandboxHomePath}/.claude/skills`,
        files: [],
      })

      await svc.startPod(baseOpts as any)

      expect(kube.patchConfigMapOwnerReferences).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`no UID`))
    })
  })

  describe(`removePodProxiesByIp`, () => {
    beforeEach(() => {
      SandboxService.proxyMap.clear()
    })

    it(`removes entries matching the IP`, () => {
      SandboxService.proxyMap.set(`http://10.0.0.1:3000`, {} as any)
      SandboxService.proxyMap.set(`http://10.0.0.2:8080`, {} as any)

      SandboxService.removePodProxiesByIp(`10.0.0.1`)

      expect(SandboxService.proxyMap.has(`http://10.0.0.1:3000`)).toBe(false)
      expect(SandboxService.proxyMap.has(`http://10.0.0.2:8080`)).toBe(true)
    })

    it(`removes multiple entries for same IP`, () => {
      SandboxService.proxyMap.set(`http://10.0.0.1:3000`, {} as any)
      SandboxService.proxyMap.set(`http://10.0.0.1:8080`, {} as any)
      SandboxService.proxyMap.set(`http://10.0.0.2:9000`, {} as any)

      SandboxService.removePodProxiesByIp(`10.0.0.1`)

      expect(SandboxService.proxyMap.has(`http://10.0.0.1:3000`)).toBe(false)
      expect(SandboxService.proxyMap.has(`http://10.0.0.1:8080`)).toBe(false)
      expect(SandboxService.proxyMap.has(`http://10.0.0.2:9000`)).toBe(true)
    })

    it(`does not match IP substring`, () => {
      SandboxService.proxyMap.set(`http://10.0.0.10:3000`, {} as any)

      SandboxService.removePodProxiesByIp(`10.0.0.1`)

      expect(SandboxService.proxyMap.has(`http://10.0.0.10:3000`)).toBe(true)
    })
  })

  describe(`exposePort`, () => {
    const setupRoutes = (instanceId: string, subdomain: string, podIp: string) => {
      kube.findSubdomainByInstance.mockReturnValue(subdomain)
      kube.routes[subdomain] = {
        meta: { podName: instanceId, podIp },
        ports: {} as Record<string, any>,
      }
      kube.patchPodAnnotation.mockResolvedValue(undefined)
    }

    it(`throws 403 for port 22`, async () => {
      await expect(svc.exposePort(`pod-1`, 22)).rejects.toThrow(
        `reserved for internal use`
      )
    })

    it(`throws 403 for port 2222`, async () => {
      await expect(svc.exposePort(`pod-1`, 2222)).rejects.toThrow(
        `reserved for internal use`
      )
    })

    it(`throws 400 for port 0`, async () => {
      await expect(svc.exposePort(`pod-1`, 0)).rejects.toThrow(`between 1 and 65535`)
    })

    it(`throws 400 for port 65536`, async () => {
      await expect(svc.exposePort(`pod-1`, 65536)).rejects.toThrow(`between 1 and 65535`)
    })

    it(`returns null when findSubdomainByInstance returns undefined`, async () => {
      kube.findSubdomainByInstance.mockReturnValue(undefined)

      const result = await svc.exposePort(`pod-1`, 3000)

      expect(result).toBeNull()
    })

    it(`returns null when routes[subdomain] is falsy`, async () => {
      kube.findSubdomainByInstance.mockReturnValue(`sub1`)
      kube.routes[`sub1`] = undefined

      const result = await svc.exposePort(`pod-1`, 3000)

      expect(result).toBeNull()
    })

    it(`happy path — updates route and returns entry`, async () => {
      setupRoutes(`pod-1`, `sub-abc`, `10.0.0.1`)

      const result = await svc.exposePort(`pod-1`, 3000)

      expect(result).not.toBeNull()
      expect(result?.port).toBe(3000)
      expect(result?.protocol).toBe(`http`)
      expect(result?.host).toBe(`10.0.0.1`)
      expect(kube.updateRoutePort).toHaveBeenCalledWith(
        `sub-abc`,
        `3000`,
        expect.objectContaining({ port: 3000 })
      )
    })

    it(`protocol defaults to http`, async () => {
      setupRoutes(`pod-1`, `sub-abc`, `10.0.0.1`)

      const result = await svc.exposePort(`pod-1`, 3000)

      expect(result?.protocol).toBe(`http`)
    })

    it(`custom protocol accepted`, async () => {
      setupRoutes(`pod-1`, `sub-abc`, `10.0.0.1`)

      const result = await svc.exposePort(`pod-1`, 3000, `https` as any)

      expect(result?.protocol).toBe(`https`)
    })

    it(`patchPodAnnotation failure is non-fatal`, async () => {
      setupRoutes(`pod-1`, `sub-abc`, `10.0.0.1`)
      kube.patchPodAnnotation.mockRejectedValue(new Error(`k8s error`))

      const result = await svc.exposePort(`pod-1`, 3000)

      expect(result).not.toBeNull()
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to persist port`),
        `k8s error`
      )
    })
  })

  describe(`removePort`, () => {
    const setupRoutesWithPort = (instanceId: string, subdomain: string, port: number) => {
      kube.findSubdomainByInstance.mockReturnValue(subdomain)
      kube.routes[subdomain] = {
        meta: { podName: instanceId, podIp: `10.0.0.1` },
        ports: {
          [String(port)]: { port, protocol: `http`, host: `10.0.0.1` },
        } as Record<string, any>,
      }
      kube.patchPodAnnotation.mockResolvedValue(undefined)
      kube.removeRoutePort.mockImplementation((sub: string, p: string) => {
        if (kube.routes[sub]) delete kube.routes[sub].ports[p]
      })
    }

    it(`returns false for unknown instance`, async () => {
      kube.findSubdomainByInstance.mockReturnValue(undefined)

      const result = await svc.removePort(`pod-1`, 3000)

      expect(result).toBe(false)
    })

    it(`returns false when port not exposed`, async () => {
      kube.findSubdomainByInstance.mockReturnValue(`sub-abc`)
      kube.routes[`sub-abc`] = {
        meta: { podName: `pod-1`, podIp: `10.0.0.1` },
        ports: {} as Record<string, any>,
      }

      const result = await svc.removePort(`pod-1`, 3000)

      expect(result).toBe(false)
    })

    it(`happy path — removes port and proxy, returns true`, async () => {
      setupRoutesWithPort(`pod-1`, `sub-abc`, 3000)
      SandboxService.proxyMap.set(`http://10.0.0.1:3000`, {} as any)

      const result = await svc.removePort(`pod-1`, 3000)

      expect(result).toBe(true)
      expect(kube.removeRoutePort).toHaveBeenCalledWith(`sub-abc`, `3000`)
      expect(SandboxService.proxyMap.has(`http://10.0.0.1:3000`)).toBe(false)
    })

    it(`patchPodAnnotation failure is non-fatal`, async () => {
      setupRoutesWithPort(`pod-1`, `sub-abc`, 3000)
      kube.patchPodAnnotation.mockRejectedValue(new Error(`k8s error`))

      const result = await svc.removePort(`pod-1`, 3000)

      expect(result).toBe(true)
    })
  })

  describe(`scanPorts`, () => {
    beforeEach(() => {
      kube.getPod.mockResolvedValue({ status: { phase: `Running` } })
      mockToContainerState.mockReturnValue(`Running`)
    })

    it(`ss succeeds — returns parsed ports`, async () => {
      MockKubeSandboxInstance.exec.mockResolvedValue({
        output: `LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*\nLISTEN 0 128 :::3000 :::*`,
        exitCode: 0,
      })

      const result = await svc.scanPorts(`pod-1`)

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ port: 3000, protocol: `http` }),
          expect.objectContaining({ port: 8080, protocol: `http` }),
        ])
      )
      expect(result).toHaveLength(2)
    })

    it(`ss fails, falls back to netstat`, async () => {
      MockKubeSandboxInstance.exec
        .mockRejectedValueOnce(new Error(`ss not found`))
        .mockResolvedValueOnce({
          output: `tcp   0   0 0.0.0.0:4000   0.0.0.0:*   LISTEN`,
          exitCode: 0,
        })

      const result = await svc.scanPorts(`pod-1`)

      expect(result).toEqual([{ port: 4000, protocol: `http` }])
    })

    it(`both fail — returns []`, async () => {
      MockKubeSandboxInstance.exec
        .mockRejectedValueOnce(new Error(`ss not found`))
        .mockRejectedValueOnce(new Error(`netstat not found`))

      const result = await svc.scanPorts(`pod-1`)

      expect(result).toEqual([])
    })

    it(`filters blocked ports 22 and 2222`, async () => {
      MockKubeSandboxInstance.exec.mockResolvedValue({
        output: [
          `LISTEN 0 128 0.0.0.0:22 0.0.0.0:*`,
          `LISTEN 0 128 0.0.0.0:2222 0.0.0.0:*`,
          `LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*`,
        ].join(`\n`),
        exitCode: 0,
      })

      const result = await svc.scanPorts(`pod-1`)

      const ports = result.map((r) => r.port)
      expect(ports).not.toContain(22)
      expect(ports).not.toContain(2222)
      expect(ports).toContain(8080)
    })

    it(`deduplicates ports`, async () => {
      MockKubeSandboxInstance.exec.mockResolvedValue({
        output: [`LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*`, `LISTEN 0 128 :::8080 :::*`].join(
          `\n`
        ),
        exitCode: 0,
      })

      const result = await svc.scanPorts(`pod-1`)

      const ports = result.map((r) => r.port)
      expect(ports.filter((p) => p === 8080)).toHaveLength(1)
    })
  })

  describe(`getExposedPorts`, () => {
    it(`returns null when findSubdomainByInstance returns undefined`, () => {
      kube.findSubdomainByInstance.mockReturnValue(undefined)

      const result = svc.getExposedPorts(`pod-1`)

      expect(result).toBeNull()
    })

    it(`returns empty object for empty ports map`, () => {
      kube.findSubdomainByInstance.mockReturnValue(`sub-abc`)
      kube.routes[`sub-abc`] = {
        meta: { podName: `pod-1`, podIp: `10.0.0.1` },
        ports: {},
      }

      const result = svc.getExposedPorts(`pod-1`)

      expect(result).toEqual({})
    })

    it(`returns port config for exposed ports`, () => {
      kube.findSubdomainByInstance.mockReturnValue(`sub-abc`)
      kube.routes[`sub-abc`] = {
        meta: { podName: `pod-1`, podIp: `10.0.0.1` },
        ports: {
          '3000': { port: 3000, protocol: `http`, host: `10.0.0.1` },
        },
      }

      const result = svc.getExposedPorts(`pod-1`)

      expect(result).toEqual({ '3000': { protocol: `http` } })
    })
  })

  describe(`broadcastPortsChanged`, () => {
    const makeWs = (readyState = 1) => ({ readyState, send: vi.fn() }) as any

    it(`no-op when no sessions for instance`, () => {
      const ws = makeWs()
      svc.addOrgMonitor(`org-1`, ws, null, `user-1`)

      svc.broadcastPortsChanged({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        ports: [],
      } as any)

      expect(ws.send).not.toHaveBeenCalled()
    })

    it(`no-op when no org monitors`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })

      svc.broadcastPortsChanged({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        ports: [],
      } as any)
    })

    it(`sends to eligible monitors`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws = makeWs()
      svc.addOrgMonitor(`org-1`, ws, null, `user-1`)

      svc.broadcastPortsChanged({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        ports: [],
      } as any)

      expect(ws.send).toHaveBeenCalledOnce()
    })

    it(`skips closed WebSocket`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws = makeWs(0)
      svc.addOrgMonitor(`org-1`, ws, null, `user-1`)

      svc.broadcastPortsChanged({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        ports: [],
      } as any)

      expect(ws.send).not.toHaveBeenCalled()
    })

    it(`skips WS without sandbox access`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws = makeWs()
      svc.addOrgMonitor(`org-1`, ws, new Set([`sb-other`]), `user-1`)

      svc.broadcastPortsChanged({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        ports: [],
      } as any)

      expect(ws.send).not.toHaveBeenCalled()
    })

    it(`catches and logs send errors`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws = makeWs()
      ws.send.mockImplementation(() => {
        throw new Error(`send failed`)
      })
      svc.addOrgMonitor(`org-1`, ws, null, `user-1`)

      expect(() =>
        svc.broadcastPortsChanged({
          instanceId: `pod-1`,
          sandboxId: `sb-1`,
          ports: [],
        } as any)
      ).not.toThrow()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to broadcast`),
        `send failed`
      )
    })
  })

  describe(`broadcastFileTreeChange`, () => {
    const makeWs = (readyState = 1, userId?: string) => {
      const ws = { readyState, send: vi.fn() } as any
      return ws
    }

    it(`no-op when no sessions`, () => {
      const ws = makeWs()
      svc.addOrgMonitor(`org-1`, ws, null, `user-1`)

      svc.broadcastFileTreeChange({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        type: `file-tree-changed`,
        path: `/foo`,
      } as any)

      expect(ws.send).not.toHaveBeenCalled()
    })

    it(`filters by excludeUserId — only other user gets message`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-2`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-2`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws1 = makeWs()
      const ws2 = makeWs()
      svc.addOrgMonitor(`org-1`, ws1, null, `user-1`)
      svc.addOrgMonitor(`org-1`, ws2, null, `user-2`)

      svc.broadcastFileTreeChange(
        {
          instanceId: `pod-1`,
          sandboxId: `sb-1`,
          type: `file-tree-changed`,
          path: `/foo`,
        } as any,
        `user-1`
      )

      expect(ws1.send).not.toHaveBeenCalled()
      expect(ws2.send).toHaveBeenCalledOnce()
    })

    it(`no-op when all users excluded`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws = makeWs()
      svc.addOrgMonitor(`org-1`, ws, null, `user-1`)

      svc.broadcastFileTreeChange(
        {
          instanceId: `pod-1`,
          sandboxId: `sb-1`,
          type: `file-tree-changed`,
          path: `/foo`,
        } as any,
        `user-1`
      )

      expect(ws.send).not.toHaveBeenCalled()
    })

    it(`skips WS whose userId is not in eligible set`, () => {
      svc.addSession(`pod-1`, {
        orgId: `org-1`,
        userId: `user-1`,
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        sessionId: `sess-1`,
        connectedAt: new Date().toISOString(),
        visibility: ESandboxSessionVisibility.private,
      })
      const ws3 = makeWs()
      svc.addOrgMonitor(`org-1`, ws3, null, `user-3`)

      svc.broadcastFileTreeChange({
        instanceId: `pod-1`,
        sandboxId: `sb-1`,
        type: `file-tree-changed`,
        path: `/foo`,
      } as any)

      expect(ws3.send).not.toHaveBeenCalled()
    })
  })

  describe(`claimStarting / releaseStarting`, () => {
    it(`delegates to db.services.sandboxStartingClaim.claimStarting and reports no conflict`, async () => {
      const resp = await svc.claimStarting(`sb-1`)

      expect(db.services.sandboxStartingClaim.claimStarting).toHaveBeenCalledWith(`sb-1`)
      expect(resp).toEqual({ conflict: false })
    })

    it(`reports a conflict when the DB claim is already held (two concurrent calls: exactly one wins)`, async () => {
      db.services.sandboxStartingClaim.claimStarting
        .mockResolvedValueOnce({ data: { id: `ssc_test01` } })
        .mockResolvedValueOnce({ data: null, conflict: true })

      const first = await svc.claimStarting(`sb-1`)
      const second = await svc.claimStarting(`sb-1`)

      expect(first).toEqual({ conflict: false })
      expect(second).toEqual({ conflict: true })
    })

    it(`throws when the DB claim call errors`, async () => {
      db.services.sandboxStartingClaim.claimStarting.mockResolvedValue({
        error: new Error(`db down`),
      })

      await expect(svc.claimStarting(`sb-1`)).rejects.toThrow(`db down`)
    })

    it(`delegates to db.services.sandboxStartingClaim.releaseStarting`, async () => {
      await svc.releaseStarting(`sb-1`)

      expect(db.services.sandboxStartingClaim.releaseStarting).toHaveBeenCalledWith(
        `sb-1`
      )
    })

    it(`throws when the DB release call errors`, async () => {
      db.services.sandboxStartingClaim.releaseStarting.mockResolvedValue({
        error: new Error(`db down`),
      })

      await expect(svc.releaseStarting(`sb-1`)).rejects.toThrow(`db down`)
    })
  })
})
