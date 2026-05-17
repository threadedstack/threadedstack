import type { WebSocket } from 'ws'
import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TShellSession } from '@TBE/types'
import type { TParsedEvent } from '@tdsk/domain'
import type { TPodEgressOpts } from '@tdsk/sandbox'
import type { RequestHandler } from 'http-proxy-middleware'
import type {
  ISandbox,
  TPlaceholderMap,
  TSandboxSession,
  TMonitorMessage,
} from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { networkInterfaces } from 'node:os'

import { DefSBConfig } from '@TBE/constants/sandbox'
import { PhTokenPrefix } from '@TBE/constants/values'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { resolveProviderEnv } from '@TBE/utils/sandbox/resolveProviderEnv'
import { resolveGitProviderEnv } from '@TBE/utils/sandbox/resolveGitProviderEnv'
import { resolveDockerPullSecrets } from '@TBE/utils/sandbox/resolveDockerPullSecrets'
import {
  EShellMsg,
  Exception,
  EProvider,
  EContainerState,
  ESandboxSessionVisibility,
} from '@tdsk/domain'
import {
  KubeClient,
  KubeSandbox,
  PodLabelKeys,
  sanitizeLabel,
  buildPodManifest,
  setupKubeWatcher,
  toContainerState,
} from '@tdsk/sandbox'

type TStartPodOpts = {
  orgId: string
  userId: string
  sandboxId: string
  projectId?: string
  egressOpts: TPodEgressOpts
}

type TPodFilter = {
  orgId?: string
  userId?: string
  projectId?: string
  state?: EContainerState
}

export type TSandboxOpts = {
  maxWait?: number
  timeoutMin?: number
  pollInterval?: number
  idleInterval?: number
  runtimeClassName?: string
}

/**
 * SandboxService orchestrates between DB config records and K8s pod operations
 */
export class SandboxService {
  private db: TDatabase
  private kube: KubeClient
  private readonly config: TSandboxOpts

  private readonly ShellTtlMS = 5 * 60 * 1000
  private readonly RingBufferSize = 1024 * 1024
  private passwords = new Map<string, string>()
  private instanceActivity = new Map<string, number>()
  private startingInstances = new Map<string, number>()
  private dockerSecrets = new Map<string, string[]>()
  private orgMonitors = new Map<string, Set<WebSocket>>()
  private monitorAccess = new WeakMap<WebSocket, Set<string>>()
  private sessions = new Map<string, TSandboxSession[]>()
  private shellSessions = new Map<string, TShellSession>()
  private eventBatches = new Map<string, TParsedEvent[]>()
  private eventBatchTimers = new Map<string, NodeJS.Timeout>()
  private idleTimer: ReturnType<typeof setInterval> | null = null

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
      ws: false,
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
   * - Seeds pod activity timestamps from hydrated pods for idle timeout tracking
   *
   * Skips initialization with a warning if K8s API is not available
   * (e.g., local development without K8s).
   */
  static async initKube(app: TApp) {
    try {
      const kube = new KubeClient()

      await kube.hydrate()

      setupKubeWatcher(kube)

      const sandbox = new SandboxService(kube, app.locals.db, app.locals.config.sandbox)

      kube.onRemoveRoute((entry) => {
        for (const portEntry of Object.values(entry.ports))
          SandboxService.removePodProxy(
            `${portEntry.protocol}://${portEntry.host}:${portEntry.port}`
          )
        entry.meta?.podName && sandbox.cleanupInstance(entry.meta.podName)
      })

      // Seed instanceActivity from hydrated pods so the idle timeout loop can
      // clean up pods that survived a backend restart with no active sessions.
      for (const entry of Object.values(kube.routes))
        if (entry.meta?.podName) sandbox.updateActivity(entry.meta.podName)

      sandbox.startIdleTimeout()

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

  constructor(kube: KubeClient, db: TDatabase, config?: TSandboxOpts) {
    this.db = db
    this.kube = kube
    this.config = { ...DefSBConfig, ...config }
  }

  async validateInstanceOwnership(
    instanceId: string,
    orgId: string,
    projectId?: string
  ): Promise<void> {
    let pod
    try {
      pod = await this.kube.getPod(instanceId)
    } catch (err: any) {
      const code = err?.code ?? err?.statusCode ?? err?.response?.statusCode
      if (code === 404) throw new Exception(404, `Pod ${instanceId} no longer exists`)
      throw err
    }
    const podOrgId = pod.metadata?.labels?.[PodLabelKeys.orgId]
    if (podOrgId !== orgId)
      throw new Exception(403, `Pod does not belong to this organization`)

    if (projectId) {
      const podProjectId = pod.metadata?.labels?.[PodLabelKeys.projectId]
      if (podProjectId && podProjectId !== sanitizeLabel(projectId))
        throw new Exception(403, `Pod does not belong to this project`)
    }
  }

  /**
   * Start a pod from a sandbox config
   */
  async startPod(opts: TStartPodOpts): Promise<string> {
    const { orgId, userId, sandboxId, projectId, egressOpts } = opts

    const { data: rawSandbox, error } = await this.db.services.sandbox.get(sandboxId)
    if (error) throw new Error(error.message)
    if (!rawSandbox) throw new Error(`Sandbox config not found: ${sandboxId}`)

    const sandbox = projectId ? rawSandbox.getEffectiveConfig(projectId) : rawSandbox

    if (projectId && sandbox === rawSandbox)
      logger.debug(
        `[Sandbox] No project config override for sandbox ${sandboxId} / project ${projectId}`
      )

    if (!sandbox.config?.image)
      throw new Exception(400, `Sandbox config is missing required "image" field`)

    const placeholders: TPlaceholderMap = {}
    if (sandbox.config.secretIds) {
      for (const secretId of sandbox.config.secretIds) {
        const token = `${PhTokenPrefix}${nanoid(16)}`
        placeholders[token] = { secretId }
      }
    }

    const sshPassword = nanoid(24)
    const extraEnv: Record<string, string> = {
      TDSK_SSH_PASSWORD: sshPassword,
    }

    const aiProviderLinks = (sandbox.providerLinks || [])
      .filter((l) => l.provider.type === EProvider.ai)
      .map((l) => ({
        provider: l.provider,
        priority: l.priority ?? 0,
        model: l.model ?? undefined,
      }))

    const dockerProviderLinks = (sandbox.providerLinks || [])
      .filter((l) => l.provider.type === EProvider.docker)
      .map((l) => ({ provider: l.provider, priority: l.priority ?? 0 }))

    const gitProviderLinks = projectId ? sandbox.getGitProviders(projectId) : []

    const secrets = new SecretResolver(this.db)

    // Resolve indexed git provider env vars
    if (gitProviderLinks.length) {
      const gitEnv = await resolveGitProviderEnv(gitProviderLinks)

      if (gitEnv.errors.length)
        throw new Exception(
          400,
          `Git provider configuration error: ${gitEnv.errors.join(`, `)}`
        )

      Object.assign(extraEnv, gitEnv.extraEnv)
      Object.assign(placeholders, gitEnv.placeholders)
    }

    // Resolve env vars for AI providers
    if (aiProviderLinks.length) {
      const providerEnv = await resolveProviderEnv(
        sandbox.config.runtime,
        aiProviderLinks,
        secrets,
        orgId
      )

      if (providerEnv.errors.length)
        throw new Exception(
          400,
          `Provider auth configuration error: ${providerEnv.errors.join(', ')}`
        )

      Object.assign(extraEnv, providerEnv.extraEnv)
      Object.assign(placeholders, providerEnv.placeholders)
    }

    // Resolve docker registry credentials and create K8s pull secrets
    const dockerSecretNames: string[] = []
    if (dockerProviderLinks.length) {
      const dockerResult = await resolveDockerPullSecrets(
        dockerProviderLinks,
        secrets,
        orgId
      )

      if (dockerResult.errors.length)
        throw new Exception(
          400,
          `Docker registry configuration error: ${dockerResult.errors.join(', ')}`
        )

      try {
        for (let i = 0; i < dockerResult.credentials.length; i++) {
          const cred = dockerResult.credentials[i]
          const slug = sanitizeLabel(sandboxId).slice(0, 8)
          const secretName = `tdsk-dkr-${slug}-${nanoid(4)}-${i}`
          await this.kube.createDockerRegistrySecret(
            secretName,
            cred.registry,
            cred.username,
            cred.password
          )
          dockerSecretNames.push(secretName)
        }
      } catch (err) {
        this.rollbackDockerSecrets(dockerSecretNames)
        throw err
      }
    }

    const manifest = buildPodManifest({
      orgId,
      userId,
      sandbox,
      extraEnv,
      projectId,
      egressOpts,
      placeholders,
      runtimeClassName: this.config.runtimeClassName,
      imagePullSecrets: dockerSecretNames.length ? dockerSecretNames : undefined,
    })

    let pod: Awaited<ReturnType<KubeClient['createPod']>>
    try {
      pod = await this.kube.createPod(manifest)
    } catch (err) {
      this.rollbackDockerSecrets(dockerSecretNames)
      throw err
    }

    const instanceId = pod.metadata?.name
    if (!instanceId) {
      this.rollbackDockerSecrets(dockerSecretNames)
      throw new Error(`Pod created but metadata.name is missing for sandbox ${sandboxId}`)
    }

    if (dockerSecretNames.length) this.dockerSecrets.set(instanceId, dockerSecretNames)

    const podUid = pod.metadata?.uid
    if (dockerSecretNames.length && instanceId && podUid) {
      const ownerRef = [
        {
          kind: `Pod`,
          uid: podUid,
          name: instanceId,
          apiVersion: `v1`,
          blockOwnerDeletion: false,
        },
      ]
      Promise.allSettled(
        dockerSecretNames.map((name) =>
          this.kube.patchSecretOwnerReferences(name, ownerRef)
        )
      )
        .then((results) => {
          for (let i = 0; i < results.length; i++) {
            if (results[i].status === `rejected`)
              logger.error(
                `[Sandbox] Failed to set ownerReference on secret ${dockerSecretNames[i]}, ` +
                  `secret may not be garbage-collected when pod is deleted:`,
                (results[i] as PromiseRejectedResult).reason?.message
              )
          }
        })
        .catch((err) =>
          logger.error(
            `[Sandbox] ownerReference patch handler failed:`,
            (err as Error).message
          )
        )
    }

    this.passwords.set(instanceId, sshPassword)
    this.instanceActivity.set(instanceId, Date.now())

    return instanceId
  }

  getPassword(instanceId: string): string | undefined {
    return this.passwords.get(instanceId)
  }

  async recoverPassword(instanceId: string): Promise<string | undefined> {
    const cached = this.passwords.get(instanceId)
    if (cached) return cached

    try {
      const result = await this.kube.runInPod(instanceId, [
        `printenv`,
        `TDSK_SSH_PASSWORD`,
      ])
      if (result.success && result.output) {
        const password = result.output.trim()
        if (!password) {
          logger.warn(`[Sandbox] TDSK_SSH_PASSWORD is empty for ${instanceId}`)
          return undefined
        }
        this.passwords.set(instanceId, password)
        return password
      }
      logger.warn(
        `[Sandbox] printenv returned non-success for ${instanceId}:`,
        result.error || `no output`
      )
    } catch (err) {
      logger.warn(
        `[Sandbox] Failed to recover password for ${instanceId}:`,
        (err as Error).message
      )
    }
    return undefined
  }

  addSession(instanceId: string, session: TSandboxSession): void {
    const list = (this.sessions.get(instanceId) || []).filter(
      (s) => s.sessionId !== session.sessionId
    )
    list.push(session)
    this.sessions.set(instanceId, list)
    this.instanceActivity.set(instanceId, Date.now())
  }

  removeSession(instanceId: string, sessionId: string): void {
    const list = this.sessions.get(instanceId) || []
    this.sessions.set(
      instanceId,
      list.filter((s) => s.sessionId !== sessionId)
    )
    this.instanceActivity.set(instanceId, Date.now())
  }

  getSessions(instanceId: string): TSandboxSession[] {
    return this.sessions.get(instanceId) || []
  }

  getInstanceSessions(sandboxId: string): Map<string, TSandboxSession[]> {
    const result = new Map<string, TSandboxSession[]>()
    for (const [instanceId, sessions] of this.sessions.entries()) {
      const sandboxSessions = sessions.filter((s) => s.sandboxId === sandboxId)
      if (sandboxSessions.length > 0) result.set(instanceId, sandboxSessions)
    }
    return result
  }

  getSessionsForSandbox(sandboxId: string): TSandboxSession[] {
    const result: TSandboxSession[] = []
    for (const podSessions of this.sessions.values()) {
      for (const s of podSessions) {
        if (s.sandboxId === sandboxId) result.push(s)
      }
    }
    return result
  }

  updateActivity(instanceId: string): void {
    this.instanceActivity.set(instanceId, Date.now())
  }

  async findRunningInstance(
    instanceId: string,
    orgId: string,
    sandboxId?: string
  ): Promise<string | undefined> {
    const pods = await this.listPods({ orgId, state: EContainerState.Running })
    const match = pods.find(
      (p) =>
        p.metadata?.name === instanceId &&
        !p.metadata?.deletionTimestamp &&
        (!sandboxId || p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId)
    )
    return match?.metadata?.name
  }

  async findRunningInstances(sandboxId: string, orgId: string): Promise<string[]> {
    const pods = await this.listPods({ orgId, state: EContainerState.Running })
    return pods
      .filter(
        (p) =>
          p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId &&
          !p.metadata?.deletionTimestamp
      )
      .filter((p) => p.metadata?.name)
      .map((p) => p.metadata!.name!)
  }

  async findActiveInstance(
    instanceId: string,
    orgId: string,
    sandboxId?: string
  ): Promise<string | undefined> {
    const pods = await this.listPods({ orgId })
    const match = pods.find((p) => {
      const phase = p.status?.phase
      return (
        p.metadata?.name === instanceId &&
        !p.metadata?.deletionTimestamp &&
        (phase === EContainerState.Running || phase === EContainerState.Pending) &&
        (!sandboxId || p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId)
      )
    })
    return match?.metadata?.name
  }

  async findActiveInstances(sandboxId: string, orgId: string): Promise<string[]> {
    const pods = await this.listPods({ orgId })
    return pods
      .filter((p) => {
        const phase = p.status?.phase
        const id = p.metadata?.labels?.[PodLabelKeys.sandboxId]
        return (
          id === sandboxId &&
          !p.metadata?.deletionTimestamp &&
          (phase === EContainerState.Running || phase === EContainerState.Pending)
        )
      })
      .filter((p) => p.metadata?.name)
      .map((p) => p.metadata!.name!)
  }

  isStarting(sandboxId: string): boolean {
    return (this.startingInstances.get(sandboxId) ?? 0) > 0
  }

  countStarting(sandboxId: string): number {
    return this.startingInstances.get(sandboxId) ?? 0
  }

  markStarting(sandboxId: string): void {
    this.startingInstances.set(
      sandboxId,
      (this.startingInstances.get(sandboxId) ?? 0) + 1
    )
  }

  clearStarting(sandboxId: string): void {
    const count = this.startingInstances.get(sandboxId) ?? 0
    if (count <= 1) this.startingInstances.delete(sandboxId)
    else this.startingInstances.set(sandboxId, count - 1)
  }

  private rollbackDockerSecrets(names: string[]): void {
    for (const name of names) {
      this.kube
        .deleteSecret(name)
        .catch((err) =>
          logger.error(
            `[Sandbox] Rollback: failed to delete docker secret ${name}, credential may be leaked:`,
            (err as Error).message
          )
        )
    }
  }

  cleanupInstance(instanceId: string): void {
    const instanceSessions = this.sessions.get(instanceId) || []
    const sandboxIds = new Set(instanceSessions.map((s) => s.sandboxId))

    for (const sandboxId of sandboxIds) {
      for (const shell of this.getShellSessionsForSandbox(sandboxId)) {
        this.removeShellSession(shell.sessionId)
      }
    }

    const dkrSecrets = this.dockerSecrets.get(instanceId)
    if (dkrSecrets?.length) {
      Promise.allSettled(dkrSecrets.map((name) => this.kube.deleteSecret(name)))
        .then((results) => {
          for (let i = 0; i < results.length; i++) {
            if (results[i].status === `rejected`)
              logger.error(
                `[Sandbox] Failed to delete docker secret ${dkrSecrets[i]}, credential may be leaked:`,
                (results[i] as PromiseRejectedResult).reason?.message
              )
          }
        })
        .catch((err) =>
          logger.error(
            `[Sandbox] Docker secret cleanup handler failed:`,
            (err as Error).message
          )
        )
        .finally(() => {
          this.dockerSecrets.delete(instanceId)
        })
    }

    this.passwords.delete(instanceId)
    this.sessions.delete(instanceId)
    this.instanceActivity.delete(instanceId)
  }

  stopIdleTimeout(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer)
      this.idleTimer = null
    }
  }

  startIdleTimeout(): void {
    if (this.idleTimer) return

    let running = false
    this.idleTimer = setInterval(async () => {
      if (running) return
      running = true

      try {
        const entries = [...this.instanceActivity.entries()]
        for (const [instanceId, lastActivity] of entries) {
          const sessions = this.getSessions(instanceId)
          if (sessions.length > 0) continue

          let timeoutMinutes = this.config.timeoutMin
          try {
            const pod = await this.kube.getPod(instanceId)
            const sandboxId = pod.metadata?.labels?.[PodLabelKeys.sandboxId]
            if (sandboxId) {
              const { data: sb } = await this.db.services.sandbox.get(sandboxId)
              if (sb) {
                const projectId = pod.metadata?.labels?.[PodLabelKeys.projectId]
                const effective = projectId ? sb.getEffectiveConfig(projectId) : sb
                if (effective.config?.idleTimeoutMinutes)
                  timeoutMinutes = effective.config.idleTimeoutMinutes
              }
            }
          } catch (err) {
            const status =
              (err as any)?.statusCode ??
              (err as any)?.response?.statusCode ??
              (err as any)?.code
            if (status === 404) {
              logger.info(
                `[Sandbox] Pod ${instanceId} no longer exists, cleaning up tracking`
              )
              try {
                this.cleanupInstance(instanceId)
              } catch (cleanupErr) {
                logger.error(
                  `[Sandbox] cleanupInstance failed for pod ${instanceId}:`,
                  (cleanupErr as Error).message
                )
                this.instanceActivity.delete(instanceId)
              }
              continue
            }
            logger.warn(
              `[Sandbox] Failed to resolve idle timeout config for pod ${instanceId}:`,
              (err as Error).message
            )
          }

          const idleMs = Date.now() - lastActivity
          const timeoutMs = (timeoutMinutes ?? 30) * 60 * 1000

          if (idleMs > timeoutMs) {
            logger.info(
              `[Sandbox] Stopping idle pod: ${instanceId} (idle ${Math.round(idleMs / 60000)}m)`
            )
            try {
              await this.stopPod(instanceId)
            } catch (err) {
              logger.warn(
                `[Sandbox] Failed to stop idle pod ${instanceId}:`,
                (err as Error).message
              )
              this.cleanupInstance(instanceId)
            }
          }
        }
      } finally {
        running = false
      }
    }, this.config.idleInterval)
  }

  /**
   * Stop a pod (delete it from K8s)
   */
  async stopPod(instanceId: string): Promise<void> {
    await this.kube.deletePod(instanceId, 30)
    this.cleanupInstance(instanceId)
  }

  async gracefulStopPod(instanceId: string, sandboxId: string): Promise<void> {
    try {
      this.notifyShellClients(sandboxId, { type: `sandbox-stopping`, sandboxId })
    } catch (err) {
      logger.warn(
        `[Sandbox] Failed to notify shell clients before stop:`,
        (err as Error).message
      )
    }
    await this.stopPod(instanceId)
  }

  /**
   * Get pod state from K8s.
   * Returns Failed for 404 (pod deleted/gone) to distinguish from truly unknown state.
   */
  async getPodState(instanceId: string): Promise<EContainerState> {
    try {
      const pod = await this.kube.getPod(instanceId)
      if (pod.metadata?.deletionTimestamp) return EContainerState.Terminating
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
  async getSandbox(instanceId: string): Promise<ISandbox> {
    const state = await this.getPodState(instanceId)
    if (state !== EContainerState.Running) {
      throw new Error(`Pod ${instanceId} is not running (state: ${state})`)
    }

    return new KubeSandbox(this.kube, instanceId)
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

  getShellSession(sessionId: string): TShellSession | undefined {
    return this.shellSessions.get(sessionId)
  }

  getShellSessionsForSandbox(sandboxId: string): TShellSession[] {
    const result: TShellSession[] = []
    for (const session of this.shellSessions.values()) {
      if (session.sandboxId === sandboxId) result.push(session)
    }
    return result
  }

  getOrgShellSessionCount(orgId: string): number {
    let count = 0
    for (const session of this.shellSessions.values()) {
      if (session.orgId === orgId) count++
    }
    return count
  }

  updateSessionVisibility(
    sessionId: string,
    visibility: ESandboxSessionVisibility
  ): boolean {
    const shell = this.shellSessions.get(sessionId)
    if (!shell) return false

    shell.visibility = visibility

    for (const [instanceId, sessions] of this.sessions.entries()) {
      const match = sessions.find((s) => s.sessionId === sessionId)
      if (match) {
        match.visibility = visibility
        break
      }
    }

    return true
  }

  addShellSession(session: TShellSession) {
    this.shellSessions.set(session.sessionId, session)
  }

  broadcastSessionList(sandboxId: string): void {
    const sessions: TSandboxSession[] = []
    for (const podSessions of this.sessions.values()) {
      for (const s of podSessions) {
        if (s.sandboxId === sandboxId) sessions.push(s)
      }
    }

    const enriched = sessions.map((s) => ({
      ...s,
      hasShellSession: !!this.shellSessions.get(s.sessionId),
    }))

    this.notifyShellClients(sandboxId, {
      sandboxId,
      sessions: enriched,
      type: EShellMsg.SessionsUpdated,
    })
  }

  removeShellSession(sessionId: string) {
    const session = this.shellSessions.get(sessionId)
    if (!session) return

    const sandboxId = session.sandboxId

    if (session.ttlTimer) clearTimeout(session.ttlTimer)
    this.clearEventBatch(sessionId)

    try {
      session.closeExec()
    } catch (err) {
      logger.warn(`[ShellSession] Failed to close exec:`, (err as Error).message)
    }

    session.buffer.clear()
    session.attachments.clear()
    this.shellSessions.delete(sessionId)
    this.broadcastSessionList(sandboxId)
  }

  notifyShellClients(sandboxId: string, message: Record<string, any>): void {
    const payload = JSON.stringify(message)
    const sessions = this.getShellSessionsForSandbox(sandboxId)

    for (const session of sessions) {
      for (const ws of session.attachments) {
        if (ws.readyState === 1) {
          try {
            ws.send(payload)
          } catch (err) {
            logger.warn(`[ShellSession] Failed to notify client:`, (err as Error).message)
          }
        }
      }
    }

    const orgId = this.getSessionsForSandbox(sandboxId)[0]?.orgId
    if (orgId) {
      const orgSet = this.orgMonitors.get(orgId)
      if (orgSet?.size) {
        for (const ws of orgSet) {
          if (ws.readyState !== 1) continue
          const allowed = this.monitorAccess.get(ws)
          if (allowed && !allowed.has(sandboxId)) continue
          try {
            ws.send(payload)
          } catch (err) {
            logger.warn(`[Monitor] Failed to notify org monitor:`, (err as Error).message)
          }
        }
      }
    }
  }

  addOrgMonitor(
    orgId: string,
    ws: import('ws').WebSocket,
    sandboxIds: Set<string> | null
  ): void {
    let set = this.orgMonitors.get(orgId)
    if (!set) {
      set = new Set()
      this.orgMonitors.set(orgId, set)
    }
    set.add(ws)
    if (sandboxIds) this.monitorAccess.set(ws, sandboxIds)
  }

  removeOrgMonitor(orgId: string, ws: import('ws').WebSocket): void {
    const set = this.orgMonitors.get(orgId)
    if (!set) return
    set.delete(ws)
    if (set.size === 0) this.orgMonitors.delete(orgId)
    this.monitorAccess.delete(ws)
  }

  attachToShellSession(
    sessionId: string,
    ws: import('ws').WebSocket
  ): TShellSession | undefined {
    const session = this.shellSessions.get(sessionId)
    if (!session) return undefined

    if (session.ttlTimer) {
      clearTimeout(session.ttlTimer)
      session.ttlTimer = null
    }

    session.attachments.add(ws)
    this.broadcastSessionList(session.sandboxId)
    return session
  }

  detachFromShellSession(
    sessionId: string,
    ws: import('ws').WebSocket,
    joinedUserId?: string
  ) {
    const session = this.shellSessions.get(sessionId)
    if (!session) return

    session.attachments.delete(ws)

    // Broadcast user-left if this is a public session
    if (session.visibility === ESandboxSessionVisibility.public) {
      const departingUserId = joinedUserId ?? session.userId
      for (const client of session.attachments) {
        if (client.readyState === 1) {
          try {
            client.send(
              JSON.stringify({
                type: `user-left`,
                sessionId,
                userId: departingUserId,
              })
            )
          } catch (err) {
            logger.warn(
              `[ShellSession] Failed to send user-left:`,
              (err as Error).message
            )
          }
        }
      }
    }

    if (session.attachments.size === 0) {
      // Persist ptyBuffer immediately so reconnecting clients get terminal history
      try {
        const rawBuffer = session.ptyRecorder.getRawBuffer()
        if (rawBuffer.length > 0) {
          this.db.services.thread
            .update({ id: session.threadId, ptyBuffer: Buffer.from(rawBuffer) })
            .catch((err) => {
              logger.error(
                `[ShellSession] PTY buffer save on detach failed for thread ${session.threadId}:`,
                (err as Error).message
              )
            })
        }
      } catch (err) {
        logger.warn(
          `[ShellSession] Failed to read raw buffer on detach:`,
          (err as Error).message
        )
      }

      session.ttlTimer = setTimeout(async () => {
        try {
          await this.flushEventBatch(sessionId)
        } catch (err) {
          logger.warn(
            `[ShellSession] Flush failed during TTL cleanup for ${sessionId}, retrying:`,
            (err as Error).message
          )
          try {
            await this.flushEventBatch(sessionId)
          } catch (retryErr) {
            logger.error(
              `[ShellSession] Flush retry failed during TTL cleanup for ${sessionId}, events lost:`,
              (retryErr as Error).message
            )
          }
        }
        this.removeShellSession(sessionId)
      }, this.ShellTtlMS)
    }

    this.broadcastSessionList(session.sandboxId)
  }

  queueEventForPersistence(sessionId: string, event: TParsedEvent) {
    let batch = this.eventBatches.get(sessionId)
    if (!batch) {
      batch = []
      this.eventBatches.set(sessionId, batch)
    }
    batch.push(event)

    if (batch.length >= 20) {
      this.flushEventBatch(sessionId).catch(async (err) => {
        logger.warn(
          `[Shell] Event batch flush failed, retrying once:`,
          (err as Error).message
        )
        try {
          await this.flushEventBatch(sessionId)
        } catch (retryErr) {
          logger.error(
            `[Shell] Event batch flush retry failed, events lost:`,
            (retryErr as Error).message
          )
        }
      })
      return
    }

    if (!this.eventBatchTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.flushEventBatch(sessionId).catch(async (err) => {
          logger.warn(
            `[Shell] Event batch flush failed, retrying once:`,
            (err as Error).message
          )
          try {
            await this.flushEventBatch(sessionId)
          } catch (retryErr) {
            logger.error(
              `[Shell] Event batch flush retry failed, events lost:`,
              (retryErr as Error).message
            )
          }
        })
      }, 2000)
      this.eventBatchTimers.set(sessionId, timer)
    }
  }

  async flushEventBatch(sessionId: string) {
    const timer = this.eventBatchTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.eventBatchTimers.delete(sessionId)
    }

    const batch = this.eventBatches.get(sessionId)
    if (!batch || batch.length === 0) return

    const session = this.shellSessions.get(sessionId)
    if (!session) {
      this.eventBatches.delete(sessionId)
      return
    }

    try {
      const messages = batch.map((event) => ({
        threadId: session.threadId,
        orgId: session.orgId,
        type: event.type,
        content: event,
      }))
      await this.db.services.message.createBatch(messages)
      this.eventBatches.delete(sessionId)
    } catch (err) {
      logger.error(
        `[ShellSession] Failed to persist ${batch.length} events for session ${sessionId}:`,
        (err as Error).message
      )
      this.eventBatches.delete(sessionId)
    }
  }

  private clearEventBatch(sessionId: string) {
    const timer = this.eventBatchTimers.get(sessionId)
    if (timer) clearTimeout(timer)
    this.eventBatchTimers.delete(sessionId)
    this.eventBatches.delete(sessionId)
  }
}
