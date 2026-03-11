import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TPodEgressOpts } from '@tdsk/sandbox'
import type { RequestHandler } from 'http-proxy-middleware'
import type { ISandbox, TPlaceholderMap } from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { networkInterfaces } from 'node:os'
import { PhTokenPrefix } from '@TBE/constants/values'
import { Exception, EContainerState } from '@tdsk/domain'
import { createProxyMiddleware } from 'http-proxy-middleware'
import {
  KubeClient,
  KubeSandbox,
  PodLabelKeys,
  buildPodManifest,
  setupKubeWatcher,
  toContainerState,
} from '@tdsk/sandbox'

type TStartPodOpts = {
  orgId: string
  userId: string
  sandboxId: string
  projectId: string
  egressOpts: TPodEgressOpts
}

type TPodFilter = {
  orgId?: string
  userId?: string
  projectId?: string
  state?: EContainerState
}

/**
 * SandboxService orchestrates between DB config records and K8s pod operations
 */
export class SandboxService {
  private db: TDatabase
  private kube: KubeClient

  // Caches existing pod proxies
  static proxyMap = new Map<string, RequestHandler>()

  static getPodIp(): string | undefined {
    const nets = networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === `IPv4` && !net.internal) return net.address
      }
    }
  }

  static removePodProxy(target: string): void {
    SandboxService.proxyMap.delete(target)
  }

  static getPodProxy(target: string) {
    let proxy = SandboxService.proxyMap.get(target)
    if (proxy) return proxy

    proxy = createProxyMiddleware({
      target,
      ws: true,
      changeOrigin: true,
      on: {
        error: (err: Error, _req: any, res: any) => {
          logger.error(`[SandboxProxy] Proxy error for ${target}:`, err.message)
          if (res && `writeHead` in res && !res.headersSent) {
            res.writeHead(502, { [`Content-Type`]: `application/json` })
            res.end(JSON.stringify({ error: `Sandbox proxy error` }))
          }
        },
      },
    })
    SandboxService.proxyMap.set(target, proxy)

    return proxy
  }

  /**
   * Initialize K8s sandbox services on backend startup.
   *
   * - Creates a KubeClient connected to the in-cluster K8s API
   * - Hydrates the in-memory route map from existing pods
   * - Starts watching for pod lifecycle events
   * - Creates a SandboxService for pod orchestration
   *
   * Skips initialization with a warning if K8s API is not available
   * (e.g., local development without K8s).
   */
  static async initKube(app: TApp) {
    try {
      const kube = new KubeClient()

      await kube.hydrate()

      kube.onRemoveRoute((entry) => {
        for (const portEntry of Object.values(entry.ports))
          SandboxService.removePodProxy(
            `${portEntry.protocol}://${portEntry.host}:${portEntry.port}`
          )
      })

      setupKubeWatcher(kube)

      const sandbox = new SandboxService(kube, app.locals.db)

      app.locals.kube = kube
      app.locals.sandbox = sandbox
      app.locals.sandboxAvailable = true
      return kube
    } catch (err) {
      app.locals.sandboxAvailable = false

      const msg = (err as Error).message || ``
      const isConnectionError =
        /ECONNREFUSED|ENOENT|ETIMEDOUT|EHOSTUNREACH|getaddrinfo/.test(msg)
      isConnectionError
        ? logger.warn(`[Sandbox] K8s not available, sandbox features disabled`, msg)
        : logger.error(`[Sandbox] Failed to initialize K8s sandbox services:`, err)
    }
  }

  constructor(kube: KubeClient, db: TDatabase) {
    this.db = db
    this.kube = kube
  }

  async validatePodOwnership(podName: string, orgId: string): Promise<void> {
    let pod
    try {
      pod = await this.kube.getPod(podName)
    } catch (err: any) {
      const code = err?.code ?? err?.statusCode ?? err?.response?.statusCode
      if (code === 404) return
      throw err
    }
    const podOrgId = pod.metadata?.labels?.[PodLabelKeys.orgId]
    if (podOrgId !== orgId)
      throw new Exception(403, `Pod does not belong to this organization`)
  }

  /**
   * Start a pod from a sandbox config
   */
  async startPod(opts: TStartPodOpts): Promise<string> {
    const { orgId, userId, sandboxId, projectId, egressOpts } = opts

    const { data: sandbox, error } = await this.db.services.sandbox.get(sandboxId)
    if (error || !sandbox) throw new Error(`Sandbox config not found: ${sandboxId}`)
    if (!sandbox.config?.image)
      throw new Exception(400, `Sandbox config is missing required "image" field`)

    const placeholders: TPlaceholderMap = {}
    if (sandbox.config.secretIds) {
      for (const secretId of sandbox.config.secretIds) {
        const token = `${PhTokenPrefix}${nanoid(16)}`
        placeholders[token] = secretId
      }
    }

    const manifest = buildPodManifest({
      orgId,
      userId,
      sandbox,
      projectId,
      egressOpts,
      placeholders,
    })

    const pod = await this.kube.createPod(manifest)
    const podName = pod.metadata?.name
    if (!podName)
      throw new Error(`Pod created but metadata.name is missing for sandbox ${sandboxId}`)

    return podName
  }

  /**
   * Stop a pod (delete it from K8s)
   */
  async stopPod(podName: string): Promise<void> {
    await this.kube.deletePod(podName, 30)
  }

  /**
   * Get pod state from K8s.
   * Returns Failed for 404 (pod deleted/gone) to distinguish from truly unknown state.
   */
  async getPodState(podName: string): Promise<EContainerState> {
    try {
      const pod = await this.kube.getPod(podName)
      return toContainerState(pod.status?.phase)
    } catch (err: any) {
      const code = err?.code ?? err?.statusCode ?? err?.response?.statusCode
      if (code === 404) return EContainerState.Failed

      throw err
    }
  }

  /**
   * Get an ISandbox instance connected to an existing running pod
   * Used by AgentRunner for tool bridging
   */
  async getSandbox(podName: string): Promise<ISandbox> {
    const state = await this.getPodState(podName)
    if (state !== EContainerState.Running) {
      throw new Error(`Pod ${podName} is not running (state: ${state})`)
    }

    return new KubeSandbox(this.kube, podName)
  }

  /**
   * List pods matching the given filter.
   * Optionally filters by pod phase (e.g. Running) client-side.
   */
  async listPods(filter: TPodFilter = {}) {
    const labels = [`${PodLabelKeys.managed}=true`]
    if (filter.orgId) labels.push(`${PodLabelKeys.orgId}=${filter.orgId}`)
    if (filter.userId) labels.push(`${PodLabelKeys.userId}=${filter.userId}`)
    if (filter.projectId) labels.push(`${PodLabelKeys.projectId}=${filter.projectId}`)

    const pods = await this.kube.listPods(labels.join(`,`))
    return filter.state ? pods.filter((p) => p.status?.phase === filter.state) : pods
  }
}
