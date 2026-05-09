import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TShellSession } from '@TBE/types'
import type { TParsedEvent } from '@tdsk/domain'
import type { TPodEgressOpts } from '@tdsk/sandbox'
import type { RequestHandler } from 'http-proxy-middleware'
import type { ISandbox, TPlaceholderMap, TSandboxSession } from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { networkInterfaces } from 'node:os'

import { DefSBConfig } from '@TBE/constants/sandbox'
import { PhTokenPrefix } from '@TBE/constants/values'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { resolveProviderEnv } from '@TBE/utils/sandbox/resolveProviderEnv'
import { resolveDockerPullSecrets } from '@TBE/utils/sandbox/resolveDockerPullSecrets'
import {
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

  private startingPods = new Set<string>()
  private readonly ShellTtlMS = 5 * 60 * 1000
  private readonly RingBufferSize = 1024 * 1024
  private passwords = new Map<string, string>()
  private podActivity = new Map<string, number>()
  private dockerSecrets = new Map<string, string[]>()
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
        entry.meta?.podName && sandbox.cleanupPod(entry.meta.podName)
      })

      // Seed podActivity from hydrated pods so the idle timeout loop can
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

  async validatePodOwnership(
    podName: string,
    orgId: string,
    projectId?: string
  ): Promise<void> {
    let pod
    try {
      pod = await this.kube.getPod(podName)
    } catch (err: any) {
      const code = err?.code ?? err?.statusCode ?? err?.response?.statusCode
      if (code === 404) throw new Exception(404, `Pod ${podName} no longer exists`)
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

    const { data: sandbox, error } = await this.db.services.sandbox.get(sandboxId)
    if (error) throw new Error(error.message)
    if (!sandbox) throw new Error(`Sandbox config not found: ${sandboxId}`)
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

    // Generate placeholder for git auth token if configured
    if (sandbox.config.gitTokenSecretId) {
      const gitToken = `${PhTokenPrefix}${nanoid(16)}`
      placeholders[gitToken] = { secretId: sandbox.config.gitTokenSecretId }
      extraEnv.TDSK_GIT_TOKEN = gitToken
    }

    if (sandbox.config.gitRepo) {
      extraEnv.TDSK_GIT_REPO = sandbox.config.gitRepo
      if (sandbox.config.gitBranch) extraEnv.TDSK_GIT_BRANCH = sandbox.config.gitBranch
    }

    // Split provider links by type: env-injected (AI, etc.) vs docker registries
    const allLinks = (sandbox.providerLinks || []).map((link) => ({
      provider: link.provider,
      priority: link.priority ?? 0,
      model: link.model ?? undefined,
    }))
    const envProviderLinks = allLinks.filter((l) => l.provider.type !== EProvider.docker)
    const dockerProviderLinks = allLinks.filter(
      (l) => l.provider.type === EProvider.docker
    )

    const secrets = new SecretResolver(this.db)

    // Resolve env vars for AI/git providers
    if (envProviderLinks.length) {
      const providerEnv = await resolveProviderEnv(
        sandbox.config.runtime,
        envProviderLinks,
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

    const podName = pod.metadata?.name
    if (!podName) {
      this.rollbackDockerSecrets(dockerSecretNames)
      throw new Error(`Pod created but metadata.name is missing for sandbox ${sandboxId}`)
    }

    if (dockerSecretNames.length) this.dockerSecrets.set(podName, dockerSecretNames)

    const podUid = pod.metadata?.uid
    if (dockerSecretNames.length && podName && podUid) {
      const ownerRef = [
        {
          apiVersion: `v1`,
          kind: `Pod`,
          name: podName,
          uid: podUid,
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

    this.passwords.set(podName, sshPassword)
    this.podActivity.set(podName, Date.now())

    return podName
  }

  getPassword(podName: string): string | undefined {
    return this.passwords.get(podName)
  }

  async recoverPassword(podName: string): Promise<string | undefined> {
    const cached = this.passwords.get(podName)
    if (cached) return cached

    try {
      const result = await this.kube.runInPod(podName, [`printenv`, `TDSK_SSH_PASSWORD`])
      if (result.success && result.output) {
        const password = result.output.trim()
        if (!password) {
          logger.warn(`[Sandbox] TDSK_SSH_PASSWORD is empty for ${podName}`)
          return undefined
        }
        this.passwords.set(podName, password)
        return password
      }
      logger.warn(
        `[Sandbox] printenv returned non-success for ${podName}:`,
        result.error || `no output`
      )
    } catch (err) {
      logger.warn(
        `[Sandbox] Failed to recover password for ${podName}:`,
        (err as Error).message
      )
    }
    return undefined
  }

  addSession(podName: string, session: TSandboxSession): void {
    const list = (this.sessions.get(podName) || []).filter(
      (s) => s.sessionId !== session.sessionId
    )
    list.push(session)
    this.sessions.set(podName, list)
    this.podActivity.set(podName, Date.now())
  }

  removeSession(podName: string, sessionId: string): void {
    const list = this.sessions.get(podName) || []
    this.sessions.set(
      podName,
      list.filter((s) => s.sessionId !== sessionId)
    )
    this.podActivity.set(podName, Date.now())
  }

  getSessions(podName: string): TSandboxSession[] {
    return this.sessions.get(podName) || []
  }

  updateActivity(podName: string): void {
    this.podActivity.set(podName, Date.now())
  }

  async findRunningPod(sandboxId: string, orgId: string): Promise<string | undefined> {
    const pods = await this.listPods({ orgId, state: EContainerState.Running })
    const match = pods.find(
      (p) =>
        p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId &&
        !p.metadata?.deletionTimestamp
    )
    return match?.metadata?.name
  }

  async findActivePod(sandboxId: string, orgId: string): Promise<string | undefined> {
    const pods = await this.listPods({ orgId })
    const match = pods.find((p) => {
      const phase = p.status?.phase
      const id = p.metadata?.labels?.[PodLabelKeys.sandboxId]
      return (
        id === sandboxId &&
        !p.metadata?.deletionTimestamp &&
        (phase === EContainerState.Running || phase === EContainerState.Pending)
      )
    })
    return match?.metadata?.name
  }

  isStarting(sandboxId: string): boolean {
    return this.startingPods.has(sandboxId)
  }

  markStarting(sandboxId: string): void {
    this.startingPods.add(sandboxId)
  }

  clearStarting(sandboxId: string): void {
    this.startingPods.delete(sandboxId)
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

  cleanupPod(podName: string): void {
    const podSessions = this.sessions.get(podName) || []
    const sandboxIds = new Set(podSessions.map((s) => s.sandboxId))

    for (const sandboxId of sandboxIds) {
      for (const shell of this.getShellSessionsForSandbox(sandboxId)) {
        this.removeShellSession(shell.sessionId)
      }
    }

    const dkrSecrets = this.dockerSecrets.get(podName)
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
          this.dockerSecrets.delete(podName)
        })
    }

    this.passwords.delete(podName)
    this.sessions.delete(podName)
    this.podActivity.delete(podName)
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
        const entries = [...this.podActivity.entries()]
        for (const [podName, lastActivity] of entries) {
          const sessions = this.getSessions(podName)
          if (sessions.length > 0) continue

          let timeoutMinutes = this.config.timeoutMin
          try {
            const pod = await this.kube.getPod(podName)
            const sandboxId = pod.metadata?.labels?.[PodLabelKeys.sandboxId]
            if (sandboxId) {
              const { data: sb } = await this.db.services.sandbox.get(sandboxId)
              if (sb?.config?.idleTimeoutMinutes)
                timeoutMinutes = sb.config.idleTimeoutMinutes
            }
          } catch (err) {
            const status =
              (err as any)?.statusCode ??
              (err as any)?.response?.statusCode ??
              (err as any)?.code
            if (status === 404) {
              logger.info(
                `[Sandbox] Pod ${podName} no longer exists, cleaning up tracking`
              )
              try {
                this.cleanupPod(podName)
              } catch (cleanupErr) {
                logger.error(
                  `[Sandbox] cleanupPod failed for pod ${podName}:`,
                  (cleanupErr as Error).message
                )
                this.podActivity.delete(podName)
              }
              continue
            }
            logger.warn(
              `[Sandbox] Failed to resolve idle timeout config for pod ${podName}:`,
              (err as Error).message
            )
          }

          const idleMs = Date.now() - lastActivity
          const timeoutMs = (timeoutMinutes ?? 30) * 60 * 1000

          if (idleMs > timeoutMs) {
            logger.info(
              `[Sandbox] Stopping idle pod: ${podName} (idle ${Math.round(idleMs / 60000)}m)`
            )
            try {
              await this.stopPod(podName)
            } catch (err) {
              logger.warn(
                `[Sandbox] Failed to stop idle pod ${podName}:`,
                (err as Error).message
              )
              this.cleanupPod(podName)
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
  async stopPod(podName: string): Promise<void> {
    await this.kube.deletePod(podName, 30)
    this.cleanupPod(podName)
  }

  async gracefulStopPod(podName: string, sandboxId: string): Promise<void> {
    try {
      this.notifyShellClients(sandboxId, { type: `sandbox-stopping`, sandboxId })
    } catch (err) {
      logger.warn(
        `[Sandbox] Failed to notify shell clients before stop:`,
        (err as Error).message
      )
    }
    await this.stopPod(podName)
  }

  /**
   * Get pod state from K8s.
   * Returns Failed for 404 (pod deleted/gone) to distinguish from truly unknown state.
   */
  async getPodState(podName: string): Promise<EContainerState> {
    try {
      const pod = await this.kube.getPod(podName)
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

    for (const [podName, sessions] of this.sessions.entries()) {
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
      type: `sessions-updated`,
      sandboxId,
      sessions: enriched,
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
    for (const session of this.getShellSessionsForSandbox(sandboxId)) {
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
