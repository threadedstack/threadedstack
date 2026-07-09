import type { WebSocket } from 'ws'
import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TShellSession } from '@TBE/types'
import type { TPodEgressOpts } from '@tdsk/sandbox'
import type { RequestHandler } from 'http-proxy-middleware'
import type {
  TProto,
  ISandbox,
  TPortConfig,
  TRouteEntry,
  TDetectedPort,
  TPlaceholderMap,
  TSandboxSession,
  TPortsChangedMessage,
  TFileTreeChangedMessage,
  TInstancesUpdatedMessage,
} from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { networkInterfaces } from 'node:os'

import { DefSBConfig, PodReadyTimeoutMS } from '@TBE/constants/sandbox'
import { PhTokenPrefix } from '@TBE/constants/values'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { resolveSkillFiles } from '@TBE/utils/sandbox/resolveSkillFiles'
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
  PodAnnotationKeys,
  setupKubeWatcher,
  toContainerState,
} from '@tdsk/sandbox'

type TStartPodOpts = {
  orgId: string
  userId: string
  sandboxId: string
  projectId?: string
  egressOpts: TPodEgressOpts
  // Pre-resolved ai-provider failover chain. When provided, startPod injects
  // the priority-0 provider's env + ALL providers' (domain-scoped) placeholders
  // and SKIPS its own resolveProviderEnv ai block, so the caller (the runtime-brain
  // executor) owns provider resolution and avoids double token generation.
  providerChain?: {
    placeholders: TPlaceholderMap
    primaryEnv: Record<string, string>
  }
  // Caller-supplied container env, applied LAST (after provider resolution) so
  // a trusted internal caller can pin exact values — e.g. the resident
  // watchdog's pod env contract (TDSK_RESIDENT_* + TDSK_BACKEND_URL).
  extraEnv?: Record<string, string>
}

type TPodFilter = {
  orgId?: string
  userId?: string
  projectId?: string
  state?: EContainerState
}

export type TSandboxOpts = {
  domain?: string
  maxWait?: number
  timeoutMin?: number
  pollInterval?: number
  idleInterval?: number
  runtimeClassName?: string
  nodeSelector?: Record<string, string>
}

/**
 * SandboxService orchestrates between DB config records and K8s pod operations
 */
export class SandboxService {
  private db: TDatabase
  private kube: KubeClient
  private readonly config: TSandboxOpts
  private readonly ShellTtlMS = 5 * 60 * 1000
  private passwords = new Map<string, string>()
  private dockerSecrets = new Map<string, string[]>()
  private instanceActivity = new Map<string, number>()
  private startingInstances = new Map<string, number>()
  private orgMonitors = new Map<string, Set<WebSocket>>()
  private sessions = new Map<string, TSandboxSession[]>()
  private shellSessions = new Map<string, TShellSession>()
  private monitorUserId = new WeakMap<WebSocket, string>()
  private static readonly BlockedPorts = new Set([22, 2222])
  private monitorAccess = new WeakMap<WebSocket, Set<string>>()
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

  static removePodProxiesByIp(ip: string): void {
    for (const [target] of SandboxService.proxyMap) {
      if (target.includes(`://${ip}:`)) SandboxService.proxyMap.delete(target)
    }
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
        if (entry.meta?.podIp) SandboxService.removePodProxiesByIp(entry.meta.podIp)
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

    // Defense in depth: sandbox.get fetches by id alone, so a caller passing a
    // cross-org sandboxId (e.g. via agent.environment.sandboxId) must be refused
    if (rawSandbox.orgId !== orgId)
      throw new Exception(
        403,
        `Sandbox ${sandboxId} does not belong to this organization`,
        `FORBIDDEN`
      )

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

    // Resolve env vars for AI providers.
    // When the caller pre-resolved a failover chain (runtime-brain executor),
    // inject the primary provider's env + every provider's placeholder and skip
    // the internal resolution (the caller already generated the tokens — resolving
    // again here would mint duplicate placeholders the egress proxy can't map).
    if (opts.providerChain) {
      Object.assign(extraEnv, opts.providerChain.primaryEnv)
      Object.assign(placeholders, opts.providerChain.placeholders)
    } else if (aiProviderLinks.length) {
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

    // Resolve skills ConfigMap
    let skillsConfigMapName: string | undefined
    let skillsVolume: Parameters<typeof buildPodManifest>[0]['skillsVolume']

    const { data: skillLinks, error: skillFetchErr } =
      await this.db.services.sandbox.listSkillsForSandbox(sandboxId, projectId)

    if (skillFetchErr) {
      logger.error(
        `[Sandbox] Failed to load skills for sandbox ${sandboxId}:`,
        (skillFetchErr as Error).message
      )
      this.rollbackDockerSecrets(dockerSecretNames)
      throw new Error(`Failed to load skill configuration for sandbox ${sandboxId}`)
    }

    if (skillLinks?.length && sandbox.config.runtime) {
      const skillRes = resolveSkillFiles(
        sandbox.config.runtime,
        skillLinks,
        sandbox.config.skillPath
      )
      if (skillRes) {
        const slug = sanitizeLabel(sandboxId).slice(0, 8)
        skillsConfigMapName = `tdsk-skills-${slug}-${nanoid(4)}`
        try {
          await this.kube.createConfigMap(skillsConfigMapName, skillRes.configMapData)
        } catch (err) {
          this.rollbackDockerSecrets(dockerSecretNames)
          throw err
        }
        skillsVolume = {
          configMapName: skillsConfigMapName,
          mountPath: skillRes.mountPath,
          files: skillRes.files,
        }
      }
    }

    // Caller-supplied env wins over anything resolved above — the caller is a
    // trusted internal surface (see TStartPodOpts.extraEnv).
    if (opts.extraEnv) Object.assign(extraEnv, opts.extraEnv)

    const manifest = buildPodManifest({
      orgId,
      userId,
      sandbox,
      extraEnv,
      projectId,
      egressOpts,
      placeholders,
      skillsVolume,
      runtimeClassName: this.config.runtimeClassName,
      nodeSelector: this.config.nodeSelector,
      imagePullSecrets: dockerSecretNames.length ? dockerSecretNames : undefined,
    })

    let pod: Awaited<ReturnType<KubeClient['createPod']>>
    try {
      pod = await this.kube.createPod(manifest)
    } catch (err) {
      if (skillsConfigMapName) {
        this.kube
          .deleteConfigMap(skillsConfigMapName)
          .catch((cmErr) =>
            logger.error(
              `[Sandbox] Rollback: failed to delete skills ConfigMap ${skillsConfigMapName}, resource may be leaked:`,
              (cmErr as Error).message
            )
          )
      }
      this.rollbackDockerSecrets(dockerSecretNames)
      throw err
    }

    const instanceId = pod.metadata?.name
    if (!instanceId) {
      if (skillsConfigMapName) {
        this.kube
          .deleteConfigMap(skillsConfigMapName)
          .catch((cmErr) =>
            logger.error(
              `[Sandbox] Rollback: failed to delete skills ConfigMap ${skillsConfigMapName}:`,
              (cmErr as Error).message
            )
          )
      }
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

    if (skillsConfigMapName && !podUid) {
      logger.warn(
        `[Sandbox] Pod ${instanceId} has no UID — ConfigMap ${skillsConfigMapName} ownerReference not set, may leak`
      )
    }

    if (skillsConfigMapName && podUid) {
      const ownerRef = [
        {
          kind: `Pod`,
          uid: podUid,
          name: instanceId,
          apiVersion: `v1`,
          blockOwnerDeletion: false,
        },
      ]
      this.kube
        .patchConfigMapOwnerReferences(skillsConfigMapName, ownerRef)
        .catch((err) =>
          logger.error(
            `[Sandbox] Failed to set ownerReference on ConfigMap ${skillsConfigMapName}:`,
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

  findInstanceForSession(sessionId: string, sandboxId: string): string | undefined {
    for (const [instanceId, sessions] of this.sessions.entries()) {
      if (sessions.some((s) => s.sessionId === sessionId && s.sandboxId === sandboxId))
        return instanceId
    }
    return undefined
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
    const sandboxOrgPairs = new Map<string, string>()
    for (const s of instanceSessions) sandboxOrgPairs.set(s.sandboxId, s.orgId)

    for (const sandboxId of sandboxOrgPairs.keys()) {
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

    for (const [sandboxId, orgId] of sandboxOrgPairs)
      this.broadcastInstanceList(sandboxId, orgId).catch((err) =>
        logger.warn(
          `[Sandbox] broadcastInstanceList failed during cleanup:`,
          (err as Error).message
        )
      )
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
                // Resident pods are long-lived by design — their main process
                // IS the resident runtime, so idleness is meaningless. Their
                // lifecycle belongs to the resident watchdog (R3), never the
                // idle reaper.
                if (effective.config?.resident) continue
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
   * Stop a pod (delete it from K8s). `gracePeriod` (seconds) defaults to 30 —
   * the resident watchdog passes a longer window so the resident runtime can
   * finish its SIGTERM checkpoint before SIGKILL (see ResidentTerminationGrace
   * Seconds); idle-pod cleanup keeps the short default (nothing to checkpoint).
   */
  async stopPod(instanceId: string, gracePeriod = 30): Promise<void> {
    await this.kube.deletePod(instanceId, gracePeriod)
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
   * Summarize non-ready pod conditions from K8s (e.g. PodScheduled=False,
   * Unschedulable — "0/3 nodes are available..."). Used to surface a concrete
   * diagnostic when a pod is stuck Pending instead of an opaque timeout.
   * Returns undefined if the pod has no conditions or the fetch fails.
   */
  async getPodConditionSummary(instanceId: string): Promise<string | undefined> {
    try {
      const pod = await this.kube.getPod(instanceId)
      const conditions = pod.status?.conditions ?? []
      const notReady = conditions.filter((c) => c.status !== `True`)
      if (!notReady.length) return undefined

      return notReady
        .map(
          (c) =>
            `${c.type}=${c.status}${c.reason ? ` (${c.reason})` : ``}${c.message ? `: ${c.message}` : ``}`
        )
        .join(`; `)
    } catch (err) {
      logger.warn(
        `[Sandbox] Failed to fetch pod conditions for ${instanceId}:`,
        (err as Error).message
      )
      return undefined
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
   * Wait for a freshly created pod to become usable.
   *
   * Phase wait: polls getPodState until the pod is Running. Throws immediately
   * for terminal states (Failed / Succeeded / Terminating — they can never
   * transition to Running) and throws when the deadline elapses first.
   *
   * Clone wait (opts.cloneCheck): after the pod is Running, polls an in-pod
   * shell check (bounded by the same overall deadline) until the entrypoint's
   * git clones exist in /workspace. A clone-wait timeout only warns and
   * returns — the pod IS running, and a failed clone is surfaced by the AI
   * tool itself. Exec errors during polling count as not-ready, never fatal.
   */
  async waitForPodReady(
    instanceId: string,
    opts?: { timeoutMs?: number; cloneCheck?: boolean }
  ): Promise<void> {
    const timeoutMs = opts?.timeoutMs ?? PodReadyTimeoutMS
    const pollMs = this.config.pollInterval ?? DefSBConfig.pollInterval
    const deadline = Date.now() + timeoutMs
    const sleep = () => new Promise((resolve) => setTimeout(resolve, pollMs))

    for (;;) {
      const state = await this.getPodState(instanceId)
      if (state === EContainerState.Running) break

      if (
        state === EContainerState.Failed ||
        state === EContainerState.Succeeded ||
        state === EContainerState.Terminating
      )
        throw new Error(`Pod ${instanceId} will never become ready (state: ${state})`)

      if (Date.now() + pollMs > deadline)
        throw new Error(
          `Timed out after ${timeoutMs / 1000}s waiting for pod ${instanceId} to be ready (state: ${state})`
        )

      await sleep()
    }

    if (!opts?.cloneCheck) return

    // The entrypoint clones repos (and optionally pre-installs deps) synchronously
    // before running the main command, so pod phase Running does not imply the
    // workspace is prepared. The entrypoint writes /workspace/.tdsk-workspace-ready
    // as its LAST step (after clone + any pre-install), so that marker is the
    // authoritative "setup complete" signal — waiting on it avoids exec'ing the AI
    // tool while a pre-install is still running (the .git dir appears before the
    // install finishes). Images that predate the marker never create it, so the
    // wait falls through to the timeout-warn-continue path below (non-fatal).
    // Runs inside the pod via the K8s Exec API (KubeSandbox), never on the host.
    const cloneReadyCmd = `[ -f /workspace/.tdsk-workspace-ready ]`
    const sb = new KubeSandbox(this.kube, instanceId)

    for (;;) {
      try {
        const result = await sb.exec(cloneReadyCmd)
        if (result.success) return
      } catch (err) {
        logger.warn(
          `[Sandbox] Clone readiness check errored for pod ${instanceId}, treating as not-ready:`,
          (err as Error).message
        )
      }

      if (Date.now() + pollMs > deadline) {
        logger.warn(
          `[Sandbox] Timed out waiting for git clone(s) in pod ${instanceId} — continuing, pod is Running`
        )
        return
      }

      await sleep()
    }
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

  async buildInstanceSnapshot(
    sandboxId: string,
    orgId: string
  ): Promise<TInstancesUpdatedMessage> {
    const { data: sandbox } = await this.db.services.sandbox.get(sandboxId)
    const maxInstances = sandbox?.config?.maxInstances ?? 1

    const allPods = await this.listPods({ orgId })
    const podsByName = new Map(allPods.map((p: any) => [p.metadata?.name, p]))

    const activeInstanceIds = allPods
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

    const instances = await Promise.all(
      activeInstanceIds.map(async (instanceId) => {
        let state: EContainerState
        try {
          state = await this.getPodState(instanceId)
        } catch (err) {
          logger.warn(
            `[Sandbox] getPodState failed for ${instanceId}, reporting Unknown:`,
            (err as Error).message
          )
          state = EContainerState.Unknown
        }
        const sessions = this.getSessions(instanceId)
        const pod = podsByName.get(instanceId)
        const userId = pod?.metadata?.labels?.[PodLabelKeys.userId] ?? ``

        return {
          state,
          userId,
          instanceId,
          sandboxId,
          sessions: sessions.map((s) => ({
            ...s,
            hasShellSession: !!this.shellSessions.get(s.sessionId),
          })),
        }
      })
    )

    return {
      sandboxId,
      instances,
      maxInstances,
      type: EShellMsg.InstancesUpdated,
    }
  }

  async broadcastInstanceList(sandboxId: string, orgId: string): Promise<void> {
    try {
      const message = await this.buildInstanceSnapshot(sandboxId, orgId)
      const payload = JSON.stringify(message)
      const orgSet = this.orgMonitors.get(orgId)
      if (!orgSet?.size) return

      for (const ws of orgSet) {
        if (ws.readyState !== 1) continue
        const allowed = this.monitorAccess.get(ws)
        if (allowed && !allowed.has(sandboxId)) continue
        try {
          ws.send(payload)
        } catch (err) {
          logger.warn(
            `[Monitor] Failed to broadcast instances-updated:`,
            (err as Error).message
          )
          this.removeOrgMonitor(orgId, ws)
        }
      }
    } catch (err) {
      logger.error(
        `[Monitor] broadcastInstanceList failed for sandbox ${sandboxId}:`,
        (err as Error).message
      )
    }
  }

  removeShellSession(sessionId: string) {
    const session = this.shellSessions.get(sessionId)
    if (!session) return

    const sandboxId = session.sandboxId

    if (session.ttlTimer) clearTimeout(session.ttlTimer)

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
    sandboxIds: Set<string> | null,
    userId: string
  ): void {
    let set = this.orgMonitors.get(orgId)
    if (!set) {
      set = new Set()
      this.orgMonitors.set(orgId, set)
    }
    set.add(ws)
    if (sandboxIds) this.monitorAccess.set(ws, sandboxIds)
    this.monitorUserId.set(ws, userId)
  }

  removeOrgMonitor(orgId: string, ws: import('ws').WebSocket): void {
    const set = this.orgMonitors.get(orgId)
    if (!set) return
    set.delete(ws)
    if (set.size === 0) this.orgMonitors.delete(orgId)
    this.monitorAccess.delete(ws)
    this.monitorUserId.delete(ws)
  }

  broadcastFileTreeChange(
    message: TFileTreeChangedMessage,
    excludeUserId?: string
  ): void {
    const { instanceId, sandboxId } = message
    const instanceSessions = this.getSessions(instanceId)
    if (!instanceSessions.length) return

    const orgId = instanceSessions[0]!.orgId
    const eligibleUserIds = new Set(
      instanceSessions.map((s) => s.userId).filter((uid) => uid !== excludeUserId)
    )
    if (!eligibleUserIds.size) return

    const orgSet = this.orgMonitors.get(orgId)
    if (!orgSet?.size) return

    const payload = JSON.stringify(message)
    for (const ws of orgSet) {
      if (ws.readyState !== 1) continue
      const wsUserId = this.monitorUserId.get(ws)
      if (!wsUserId || !eligibleUserIds.has(wsUserId)) continue
      const allowed = this.monitorAccess.get(ws)
      if (allowed && !allowed.has(sandboxId)) continue
      try {
        ws.send(payload)
      } catch (err) {
        logger.warn(
          `[Monitor] Failed to broadcast file-tree-changed:`,
          (err as Error).message
        )
      }
    }
  }

  async exposePort(
    instanceId: string,
    port: number,
    protocol: TProto = `http` as TProto
  ): Promise<TRouteEntry | null> {
    if (SandboxService.BlockedPorts.has(port))
      throw new Exception(403, `Port ${port} is reserved for internal use`)
    if (port < 1 || port > 65535)
      throw new Exception(400, `Port must be between 1 and 65535`)

    const subdomain = this.kube.findSubdomainByInstance(instanceId)
    if (!subdomain) return null

    const route = this.kube.routes[subdomain]
    if (!route) return null

    const entry: TRouteEntry = {
      port,
      protocol,
      host: route.meta.podIp,
    }

    this.kube.updateRoutePort(subdomain, String(port), entry)

    try {
      const portsAnnotation: Record<string, { protocol: string }> = {}
      for (const [p, e] of Object.entries(route.ports))
        portsAnnotation[p] = { protocol: e.protocol }

      await this.kube.patchPodAnnotation(instanceId, {
        [PodAnnotationKeys.ports]: JSON.stringify(portsAnnotation),
      })
    } catch (err) {
      logger.error(
        `[Sandbox] Failed to persist port ${port} annotation on ${instanceId} — port may not survive restart:`,
        (err as Error).message
      )
    }

    return entry
  }

  async removePort(instanceId: string, port: number): Promise<boolean> {
    const subdomain = this.kube.findSubdomainByInstance(instanceId)
    if (!subdomain) return false

    const route = this.kube.routes[subdomain]
    if (!route) return false

    const portStr = String(port)
    const portEntry = route.ports[portStr]
    if (!portEntry) return false

    this.kube.removeRoutePort(subdomain, portStr)
    SandboxService.removePodProxy(
      `${portEntry.protocol}://${portEntry.host}:${portEntry.port}`
    )

    try {
      const portsAnnotation: Record<string, { protocol: string }> = {}
      for (const [p, e] of Object.entries(route.ports))
        portsAnnotation[p] = { protocol: e.protocol }

      await this.kube.patchPodAnnotation(instanceId, {
        [PodAnnotationKeys.ports]: JSON.stringify(portsAnnotation),
      })
    } catch (err) {
      logger.error(
        `[Sandbox] Failed to persist port removal annotation on ${instanceId} — port may reappear on restart:`,
        (err as Error).message
      )
    }

    return true
  }

  async scanPorts(instanceId: string): Promise<TDetectedPort[]> {
    try {
      const sbInstance = await this.getSandbox(instanceId)

      let output = ``
      let exitCode = 1
      try {
        const result = await sbInstance.exec(`ss`, [`-tln`])
        output = result.output || ``
        exitCode = result.exitCode ?? 1
      } catch (err) {
        logger.debug(
          `[Sandbox] ss failed for ${instanceId}, trying netstat:`,
          (err as Error).message
        )
      }

      if (exitCode !== 0) {
        try {
          const result = await sbInstance.exec(`netstat`, [`-tln`])
          output = result.output || ``
          exitCode = result.exitCode ?? 1
        } catch (err) {
          logger.warn(
            `[Sandbox] Both ss and netstat failed for ${instanceId}:`,
            (err as Error).message
          )
        }
      }

      if (exitCode !== 0) return []

      return this.parseListeningPorts(output)
    } catch (err) {
      logger.warn(`[Sandbox] Port scan failed for ${instanceId}:`, (err as Error).message)
      return []
    }
  }

  private parseListeningPorts(output: string): TDetectedPort[] {
    const ports = new Set<number>()
    const lines = output.split(`\n`)

    for (const line of lines) {
      if (!line.includes(`LISTEN`)) continue
      const parts = line.trim().split(/\s+/)
      const addrCol = parts.find((p) => p.includes(`:`)) || ``
      const lastColon = addrCol.lastIndexOf(`:`)
      if (lastColon < 0) continue
      const portNum = Number(addrCol.slice(lastColon + 1))
      if (
        !Number.isNaN(portNum) &&
        portNum > 0 &&
        portNum <= 65535 &&
        !SandboxService.BlockedPorts.has(portNum)
      )
        ports.add(portNum)
    }

    return Array.from(ports)
      .sort((a, b) => a - b)
      .map((port) => ({ port, protocol: `http` as TProto }))
  }

  getExposedPorts(instanceId: string): Record<string, TPortConfig> | null {
    const subdomain = this.kube.findSubdomainByInstance(instanceId)
    if (!subdomain) return null
    const route = this.kube.routes[subdomain]
    if (!route) return null

    const result: Record<string, TPortConfig> = {}
    for (const [port, entry] of Object.entries(route.ports))
      result[port] = { protocol: entry.protocol }
    return result
  }

  buildPortUrl(subdomain: string, port: number): string {
    return `https://${port}--${subdomain}.${this.config.domain}`
  }

  buildPortUrlTemplate(subdomain: string): string {
    return `https://{port}--${subdomain}.${this.config.domain}`
  }

  broadcastPortsChanged(message: TPortsChangedMessage): void {
    const { instanceId, sandboxId } = message
    const instanceSessions = this.getSessions(instanceId)
    if (!instanceSessions.length) return

    const orgId = instanceSessions[0]!.orgId
    const orgSet = this.orgMonitors.get(orgId)
    if (!orgSet?.size) return

    const payload = JSON.stringify(message)
    for (const ws of orgSet) {
      if (ws.readyState !== 1) continue
      const allowed = this.monitorAccess.get(ws)
      if (allowed && !allowed.has(sandboxId)) continue
      try {
        ws.send(payload)
      } catch (err) {
        logger.warn(
          `[Monitor] Failed to broadcast ports-changed:`,
          (err as Error).message
        )
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
      session.ttlTimer = setTimeout(() => {
        this.removeShellSession(sessionId)
      }, this.ShellTtlMS)
    }

    this.broadcastSessionList(session.sandboxId)
  }
}
