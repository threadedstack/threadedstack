import type { Readable } from 'stream'
import type { TKubeClientConfig, TKubeEventHandlers } from '@TSB/types'
import type { TSandboxResult, TRouteMap, TRouteMapEntry, TRouteEntry } from '@tdsk/domain'

import { PassThrough } from 'stream'
import { logger } from '@TSB/utils/logger'
import { EProto, EContainerState } from '@tdsk/domain'
import * as k8s from '@kubernetes/client-node'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { getKubeNS } from '@TSB/kube/getKubeNS'
import { toContainerState } from '@TSB/kube/toContainerState'

import {
  PodLabelKeys,
  PodCycleInterval,
  PodAnnotationKeys,
  PodManagedSelector,
} from '@TSB/constants/kube'

export class KubeClient {
  private namespace: string
  private kubeExec: k8s.Exec
  private watcher: k8s.Watch
  private kc: k8s.KubeConfig
  private coreApi: k8s.CoreV1Api
  private watchAbort: AbortController | null = null
  private cycleTimer: ReturnType<typeof setInterval> | null = null

  private _routes: TRouteMap = {}

  get routes(): Readonly<TRouteMap> {
    return this._routes
  }

  private onRouteRemoved: ((entry: TRouteMapEntry) => void) | null = null

  onRemoveRoute(callback: (entry: TRouteMapEntry) => void): void {
    this.onRouteRemoved = callback
  }

  constructor(config: TKubeClientConfig = {}) {
    this.kc = new k8s.KubeConfig()

    if (config.inCluster !== false) {
      try {
        this.kc.loadFromCluster()
      } catch (err) {
        logger.warn(
          `[KubeClient] In-cluster config failed, falling back to default:`,
          (err as Error).message
        )
        this.kc.loadFromDefault()
      }
    } else {
      this.kc.loadFromDefault()
    }

    this.kubeExec = new k8s.Exec(this.kc)
    this.watcher = new k8s.Watch(this.kc)
    this.namespace = getKubeNS(config.namespace)
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
  }

  // --- Pod CRUD ---

  async createPod(manifest: k8s.V1Pod): Promise<k8s.V1Pod> {
    return await this.coreApi.createNamespacedPod({
      body: manifest,
      namespace: this.namespace,
    })
  }

  async getPod(name: string): Promise<k8s.V1Pod> {
    return await this.coreApi.readNamespacedPod({
      name,
      namespace: this.namespace,
    })
  }

  async listPods(labelSelector?: string): Promise<k8s.V1Pod[]> {
    const resp = await this.coreApi.listNamespacedPod({
      namespace: this.namespace,
      labelSelector: labelSelector || PodManagedSelector,
    })
    return resp.items
  }

  async deletePod(name: string, gracePeriod?: number): Promise<void> {
    await this.coreApi.deleteNamespacedPod({
      name,
      namespace: this.namespace,
      gracePeriodSeconds: gracePeriod,
    })
  }

  // --- Shell Operations ---

  /**
   * Run a command inside a pod container via K8s API exec.
   * Uses K8s Exec API (not child_process) — the command array is sent directly to the container without host shell interpretation.
   */
  async runInPod(
    podName: string,
    command: string[],
    stdin?: Readable
  ): Promise<TSandboxResult> {
    return new Promise((resolve, reject) => {
      const stdoutStream = new PassThrough()
      const stderrStream = new PassThrough()
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      stdoutStream.on(`data`, (chunk: Buffer) => stdoutChunks.push(chunk))
      stderrStream.on(`data`, (chunk: Buffer) => stderrChunks.push(chunk))

      this.kubeExec
        .exec(
          this.namespace,
          podName,
          `sandbox`,
          command,
          stdoutStream,
          stderrStream,
          stdin || null,
          false,
          (status: k8s.V1Status) => {
            const stdout = Buffer.concat(stdoutChunks).toString(`utf-8`)
            const stderr = Buffer.concat(stderrChunks).toString(`utf-8`)
            const exitCode =
              status.status === `Success`
                ? 0
                : Number(status.details?.causes?.[0]?.message || 1)

            resolve({
              exitCode,
              output: stdout,
              success: exitCode === 0,
              error: stderr || undefined,
            })
          }
        )
        .catch((err) => {
          const stdout = Buffer.concat(stdoutChunks).toString(`utf-8`)
          const stderr = Buffer.concat(stderrChunks).toString(`utf-8`)

          if (!stdout && !stderr) {
            reject(err)
          } else {
            resolve({
              exitCode: 1,
              success: false,
              output: stdout,
              error: stderr || err.message,
            })
          }
        })
    })
  }

  // --- Watch ---

  async watch(events: TKubeEventHandlers): Promise<void> {
    const path = `/api/v1/namespaces/${this.namespace}/pods`
    this.watchAbort = new AbortController()

    await this.watcher.watch(
      path,
      { labelSelector: PodManagedSelector },
      (type: string, pod: k8s.V1Pod) => {
        const handler = type.toLowerCase() as keyof TKubeEventHandlers
        events[handler]?.(pod)
      },
      (err?: any) => {
        if (!err) err = new Error(`Kubernetes Watch listener failed without error`)
        isFunc(events.error) ? events.error?.(err) : logger.error(err.message)
      }
    )
  }

  cycleListen(events: TKubeEventHandlers, intervalMs = PodCycleInterval): void {
    const restart = async () => {
      this.stopWatch()
      await this.watch(events)
    }

    restart().catch((err) => events.error?.(err))
    this.cycleTimer = setInterval(
      () => restart().catch((err) => events.error?.(err)),
      intervalMs
    )
  }

  stopWatch(): void {
    this.watchAbort?.abort()
    this.watchAbort = null
  }

  cleanup(): void {
    this.stopWatch()
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer)
      this.cycleTimer = null
    }
  }

  // --- Hydration ---

  async hydrate(): Promise<TRouteMap> {
    const pods = await this.listPods()
    for (const key of Object.keys(this._routes)) delete this._routes[key]

    for (const pod of pods) {
      if (this.shouldHydrate(pod)) {
        this.hydrateSingle(pod)
      } else if (this.shouldRemove(pod)) {
        const name = pod.metadata?.name
        if (name) {
          try {
            await this.deletePod(name)
          } catch (err) {
            logger.warn(
              `[KubeClient] Failed to clean up pod:`,
              name,
              (err as Error).message
            )
          }
        }
      }
    }

    return this._routes
  }

  hydrateSingle(pod: k8s.V1Pod): void {
    if (this.shouldRemove(pod)) {
      this.removeFromCache(pod)
      return
    }

    const labels = pod.metadata?.labels || {}
    const annotations = pod.metadata?.annotations || {}
    const subdomain = annotations[PodAnnotationKeys.subdomain]
    const podIp = pod.status?.podIP

    if (!subdomain) {
      logger.warn(
        `Pod ${pod.metadata?.name} missing subdomain annotation, skipping hydration`
      )
      return
    }
    if (!podIp) {
      logger.info(
        `[KubeClient] Pod ${pod.metadata?.name} has no IP yet (phase: ${pod.status?.phase}), skipping hydration`
      )
      return
    }

    let ports: Record<string, { protocol?: string }> = {}
    let placeholders: Record<string, string> = {}

    try {
      const portsRaw = annotations[PodAnnotationKeys.ports]
      if (portsRaw) ports = JSON.parse(portsRaw)

      const placeholdersRaw = annotations[PodAnnotationKeys.placeholders]
      if (placeholdersRaw) placeholders = JSON.parse(placeholdersRaw)
    } catch (err) {
      logger.warn(
        `Malformed annotation JSON on pod ${pod.metadata?.name}:`,
        (err as Error).message
      )
      return
    }

    const podName = pod.metadata?.name
    const sandboxId = labels[PodLabelKeys.sandboxId]
    if (!podName || !sandboxId) {
      logger.warn(`[KubeClient] Pod missing name or sandboxId label, skipping hydration`)
      return
    }

    const phase = toContainerState(pod.status?.phase)

    const portEntries: Record<string, TRouteEntry> = {}
    for (const [port, cfg] of Object.entries(ports)) {
      portEntries[port] = {
        host: podIp,
        port: Number(port),
        protocol: (cfg.protocol || EProto.http) as TRouteEntry[`protocol`],
      }
    }

    this._routes[subdomain] = {
      placeholders,
      ports: portEntries,
      meta: {
        podIp,
        podName,
        sandboxId,
        state: phase,
      },
    }
  }

  removeFromCache(pod: k8s.V1Pod): void {
    const subdomain = pod.metadata?.annotations?.[PodAnnotationKeys.subdomain]
    if (subdomain && this._routes[subdomain]) {
      const entry = this._routes[subdomain]
      delete this._routes[subdomain]
      this.onRouteRemoved?.(entry)
    }
  }

  private shouldHydrate(pod: k8s.V1Pod): boolean {
    if (pod.metadata?.deletionTimestamp) return false
    const phase = pod.status?.phase
    return phase === EContainerState.Running || phase === EContainerState.Pending
  }

  private shouldRemove(pod: k8s.V1Pod): boolean {
    if (pod.metadata?.deletionTimestamp) return true
    const phase = pod.status?.phase
    return phase === EContainerState.Failed || phase === EContainerState.Succeeded
  }
}
