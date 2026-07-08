import type { TApp } from '@TBE/types'

import { EQueryOp } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { mintResidentToken } from '@TBE/utils/agent/residentToken'
import { ResidentConfigsCollection } from '@TBE/utils/agent/residentAllowlist'

/** The heartbeat collection the resident's `heartbeat` Function upserts. */
export const ResidentStatusCollection = `resident_status`

/** Reconcile cadence — a sibling of the scheduler's 60s tick, never entangled with it. */
export const WatchdogTickMs = 60_000
/** A resident_status write older than this is a stale heartbeat. */
export const HeartbeatStaleMs = 3 * 60_000
/** After a (re)start, give the pod this long to clone/boot/beat before re-checking. */
export const StartupGraceMs = 5 * 60_000
/** Crash-loop window: this many watchdog restarts inside an hour ⇒ degraded. */
export const CrashLoopWindowMs = 60 * 60_000
export const CrashLoopMaxRestarts = 3

/**
 * The pod env contract. MUST mirror repos/resident/src/constants.ts — the
 * runtime refuses to boot unless ALL five are present (readResidentEnv).
 */
export const ResidentEnvVars = {
  agentId: `TDSK_RESIDENT_AGENT_ID`,
  token: `TDSK_RESIDENT_TOKEN`,
  backendUrl: `TDSK_BACKEND_URL`,
  orgId: `TDSK_RESIDENT_ORG_ID`,
  projectId: `TDSK_RESIDENT_PROJECT_ID`,
} as const

export type TWatchdogAction =
  | `healthy`
  | `started`
  | `restarted`
  | `degraded`
  | `skipped`
  | `error`

export type TWatchdogResult = {
  agentId: string
  projectId: string
  action: TWatchdogAction
  reason?: string
}

export type TWatchdogSummary = {
  checked: number
  results: TWatchdogResult[]
}

export type TResidentWatchdogOpts = {
  tickMs?: number
  staleMs?: number
  startupGraceMs?: number
  crashLoopWindowMs?: number
  crashLoopMaxRestarts?: number
  nowFn?: () => number
  /** In-cluster backend base URL override (defaults to http://<egress.serviceName>:<server.port>). */
  backendUrl?: string
}

export type TResidentWatchdog = {
  start: () => void
  stop: () => void
  /** One reconcile pass — also what the interval drives. Bails when a pass is in flight. */
  tick: () => Promise<TWatchdogSummary>
  /**
   * Release rolling-restart: recreate EVERY resident pod (fresh token, full
   * env contract) regardless of heartbeat freshness. The deploy path calls
   * this in R4/R5 — deliberately NOT wired to deploys yet. Rolling restarts
   * never count toward the crash-loop window.
   */
  rollingRestart: () => Promise<TWatchdogSummary>
}

/**
 * The resident watchdog — a small reconciler that owns resident pod
 * lifecycles (spec §2: "the scheduler, shrunk to its useful core"). Every
 * tick it walks each `resident_configs` record across every project, resolves
 * the agent's body sandbox (`agent.environment.sandboxId`), and ensures a
 * resident-mode pod exists with a fresh heartbeat (a `resident_status` write
 * younger than 3 minutes). Missing pod or stale heartbeat ⇒ (re)start via the
 * sandbox service WITH the full five-var env contract, minting (rotating) the
 * pod-scoped token via `mintResidentToken` each start. A crash-looping
 * resident (≥3 watchdog restarts inside an hour, tracked in-memory) is marked
 * `degraded` on its resident_status record and skipped until the hour rolls.
 *
 * A SIBLING of the scheduler: same lifecycle home (started in main, stopped
 * by signals), zero entanglement with the schedule tick. Inert until R4 — no
 * resident_configs record exists, so every tick reconciles nothing.
 */
export const createResidentWatchdog = (
  app: TApp,
  opts: TResidentWatchdogOpts = {}
): TResidentWatchdog => {
  const nowFn = opts.nowFn ?? Date.now
  const tickMs = opts.tickMs ?? WatchdogTickMs
  const staleMs = opts.staleMs ?? HeartbeatStaleMs
  const startupGraceMs = opts.startupGraceMs ?? StartupGraceMs
  const crashLoopWindowMs = opts.crashLoopWindowMs ?? CrashLoopWindowMs
  const crashLoopMaxRestarts = opts.crashLoopMaxRestarts ?? CrashLoopMaxRestarts

  let timer: ReturnType<typeof setInterval> | undefined
  let current: Promise<TWatchdogSummary> | undefined
  let warnedNoSandbox = false

  /** Watchdog-initiated restart timestamps per agent (the crash-loop window). */
  const restartLog = new Map<string, number[]>()
  /** Last watchdog-initiated pod start per agent (the startup grace). */
  const lastStartAt = new Map<string, number>()

  const resolveBackendUrl = (): string | undefined => {
    if (opts.backendUrl) return opts.backendUrl
    const config = app.locals.config
    const serviceName = config?.egress?.serviceName
    const port = config?.server?.port
    return serviceName && port ? `http://${serviceName}:${port}` : undefined
  }

  /** Upsert degraded=true onto the agent's resident_status record (idempotent). */
  const markDegraded = async (projectId: string, agentId: string): Promise<void> => {
    const { db } = app.locals
    const { data: rows } = await db.services.record.query(
      projectId,
      ResidentStatusCollection,
      { where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }], limit: 1 }
    )
    const existing = rows?.[0]
    if (existing?.data?.degraded === true) return

    const { error } = await db.services.record.upsert(
      projectId,
      ResidentStatusCollection,
      {
        ...(existing ? { id: existing.id } : {}),
        data: { ...(existing?.data ?? {}), agentId, degraded: true },
      }
    )
    if (error)
      logger.error(
        `[ResidentWatchdog] Failed to mark ${agentId} degraded: ${error.message}`
      )
  }

  /** Reconcile ONE resident_configs record. `force` = rolling restart semantics. */
  const reconcileResident = async (
    projectId: string,
    record: { data?: Record<string, unknown> },
    force: boolean
  ): Promise<TWatchdogResult> => {
    const agentId =
      typeof record.data?.agentId === `string` ? (record.data.agentId as string) : ``
    const base = { agentId, projectId }
    if (!agentId) return { ...base, action: `error`, reason: `record has no agentId` }

    try {
      const { db, sandbox: sandboxService } = app.locals
      const now = nowFn()

      // Crash-loop gate FIRST (cheap, in-memory): ≥N watchdog restarts inside
      // the window ⇒ degraded + skip until the hour rolls. Rolling restarts
      // bypass the gate — a deploy must always be able to recreate the pod.
      const restarts = (restartLog.get(agentId) ?? []).filter(
        (at) => now - at < crashLoopWindowMs
      )
      restartLog.set(agentId, restarts)
      if (!force && restarts.length >= crashLoopMaxRestarts) {
        await markDegraded(projectId, agentId)
        return {
          ...base,
          action: `degraded`,
          reason: `${restarts.length} restarts in the last hour`,
        }
      }

      const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
      if (agentErr) return { ...base, action: `error`, reason: agentErr.message }
      if (!agent) return { ...base, action: `error`, reason: `agent not found` }

      const effective = agent.getEffectiveConfig(projectId)
      const sandboxId = effective.environment?.sandboxId
      if (!sandboxId)
        return {
          ...base,
          action: `skipped`,
          reason: `no body sandbox (agent.environment.sandboxId)`,
        }

      const { data: sandboxRow, error: sbErr } = await db.services.sandbox.get(sandboxId)
      if (sbErr) return { ...base, action: `error`, reason: sbErr.message }
      if (!sandboxRow)
        return { ...base, action: `error`, reason: `sandbox ${sandboxId} not found` }

      const sbEffective = sandboxRow.getEffectiveConfig(projectId)
      const residentMode = sbEffective.config?.resident
      if (!residentMode)
        return {
          ...base,
          action: `skipped`,
          reason: `sandbox ${sandboxId} is not in resident mode`,
        }
      if (residentMode.agentId !== agentId)
        return {
          ...base,
          action: `skipped`,
          reason: `sandbox ${sandboxId} resident mode is bound to ${residentMode.agentId}`,
        }

      // Startup grace: a pod we just (re)started needs time to clone, boot,
      // and land its first heartbeat before it can be judged stale.
      const startedAt = lastStartAt.get(agentId)
      if (!force && startedAt !== undefined && now - startedAt < startupGraceMs)
        return { ...base, action: `skipped`, reason: `startup grace` }

      const pods: string[] = await sandboxService!.findActiveInstances(
        sandboxId,
        agent.orgId
      )

      if (!force && pods.length) {
        const { data: statusRows } = await db.services.record.query(
          projectId,
          ResidentStatusCollection,
          { where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }], limit: 1 }
        )
        const updatedAt = statusRows?.[0]?.updatedAt
        const fresh = Boolean(updatedAt && now - new Date(updatedAt).getTime() < staleMs)
        if (fresh) return { ...base, action: `healthy` }
      }

      const backendUrl = resolveBackendUrl()
      if (!backendUrl)
        return {
          ...base,
          action: `error`,
          reason: `no in-cluster backend URL (egress.serviceName/server.port unset)`,
        }

      // This IS a watchdog restart — count it toward the crash-loop window
      // (rolling restarts excepted) BEFORE the attempt, so a start that
      // crashes the backend path still counts.
      if (!force) {
        restarts.push(now)
        restartLog.set(agentId, restarts)
      }

      // A stale-but-present pod is torn down first — one body per resident.
      for (const instanceId of pods) {
        await sandboxService!
          .stopPod(instanceId)
          .catch((err: Error) =>
            logger.error(
              `[ResidentWatchdog] Failed to stop stale pod ${instanceId}: ${err.message}`
            )
          )
      }

      // Mint (rotate) the pod-scoped token: previous ACTIVE resident keys for
      // the agent are revoked, and the fresh secret exists ONLY in this env.
      const { key } = await mintResidentToken(db, agent.orgId, agentId)

      const instanceId = await sandboxService!.startPod({
        orgId: agent.orgId,
        userId: sandboxRow.userId ?? ``,
        sandboxId,
        projectId,
        egressOpts: app.locals.config.egress,
        extraEnv: {
          [ResidentEnvVars.agentId]: agentId,
          [ResidentEnvVars.token]: key,
          [ResidentEnvVars.backendUrl]: backendUrl,
          [ResidentEnvVars.orgId]: agent.orgId,
          [ResidentEnvVars.projectId]: projectId,
        },
      })
      lastStartAt.set(agentId, now)

      logger.info(
        `[ResidentWatchdog] ${pods.length ? `Restarted` : `Started`} resident pod ${instanceId} for agent ${agentId}`
      )
      return {
        ...base,
        action: pods.length ? `restarted` : `started`,
        reason: instanceId,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[ResidentWatchdog] Reconcile failed for ${agentId}: ${message}`)
      return { ...base, action: `error`, reason: message }
    }
  }

  /** One full pass over every resident_configs record in every project. */
  const sweep = async (force: boolean): Promise<TWatchdogSummary> => {
    const summary: TWatchdogSummary = { checked: 0, results: [] }
    const { db, sandbox: sandboxService } = app.locals

    if (!sandboxService) {
      if (!warnedNoSandbox) {
        warnedNoSandbox = true
        logger.warn(
          `[ResidentWatchdog] No sandbox service (K8s unavailable) — watchdog is idle`
        )
      }
      return summary
    }

    const { data: collections, error } = await db.services.collection.listByName(
      ResidentConfigsCollection
    )
    if (error) {
      logger.error(
        `[ResidentWatchdog] Failed to list ${ResidentConfigsCollection} collections: ${error.message}`
      )
      return summary
    }

    for (const collection of collections ?? []) {
      const { data: records, error: recordsErr } = await db.services.record.query(
        collection.projectId,
        ResidentConfigsCollection,
        {}
      )
      if (recordsErr) {
        logger.error(
          `[ResidentWatchdog] Failed to query resident configs for project ${collection.projectId}: ${recordsErr.message}`
        )
        continue
      }

      for (const record of records ?? []) {
        summary.checked++
        summary.results.push(await reconcileResident(collection.projectId, record, force))
      }
    }

    return summary
  }

  const tick = async (): Promise<TWatchdogSummary> => {
    // Bail-if-busy, the scheduler's own reentrancy model — a slow pass never
    // stacks a second concurrent pass behind it.
    if (current) return { checked: 0, results: [] }
    const run = sweep(false)
    current = run
    try {
      return await run
    } finally {
      current = undefined
    }
  }

  const rollingRestart = async (): Promise<TWatchdogSummary> => {
    // Serialize behind any in-flight pass — a deploy restart must run, not bail.
    while (current) await current.catch(() => undefined)
    const run = sweep(true)
    current = run
    try {
      return await run
    } finally {
      current = undefined
    }
  }

  return {
    tick,
    rollingRestart,
    start: () => {
      if (timer) {
        logger.warn(`[ResidentWatchdog] Already running`)
        return
      }
      logger.info(`[ResidentWatchdog] Starting resident watchdog (${tickMs}ms tick)`)
      void tick().catch((err) =>
        logger.error(`[ResidentWatchdog] Initial tick failed: ${err}`)
      )
      timer = setInterval(() => {
        void tick().catch((err) =>
          logger.error(`[ResidentWatchdog] Periodic tick failed: ${err}`)
        )
      }, tickMs)
      timer.unref?.()
    },
    stop: () => {
      if (!timer) return
      clearInterval(timer)
      timer = undefined
      logger.info(`[ResidentWatchdog] Stopped`)
    },
  }
}
