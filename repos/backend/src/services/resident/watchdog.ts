import type { TApp } from '@TBE/types'
import type { TSandboxChain } from '@TBE/utils/sandbox/resolveSandboxChain'

import { EQueryOp, CliMaxProviderFailovers } from '@tdsk/domain'
import { ResidentTerminationGraceSeconds } from '@tdsk/sandbox'
import { logger } from '@TBE/utils/logger'
import {
  createResidentToken,
  revokeResidentKeysExcept,
} from '@TBE/utils/agent/residentToken'
import { ResidentConfigsCollection } from '@TBE/utils/agent/residentAllowlist'
import { resolveSandboxProviderChain } from '@TBE/utils/sandbox/resolveSandboxChain'

/** The heartbeat collection the resident's `heartbeat` Function upserts. */
export const ResidentStatusCollection = `resident_status`

/** Reconcile cadence — a sibling of the scheduler's 60s tick, never entangled with it. */
export const WatchdogTickMs = 60_000
/** A resident_status write older than this is a stale heartbeat. */
export const HeartbeatStaleMs = 3 * 60_000
/** After a (re)start, skip re-checks entirely for this long (pod-not-yet-listed race). */
export const StartupGraceMs = 5 * 60_000
/**
 * Boot budget: a present pod that has NEVER heartbeated since we started it is
 * still cloning + building — it is NOT torn down until this elapses. Longer
 * than StartupGraceMs because a cold `git clone` + `pnpm build` legitimately
 * runs past 5 minutes; tearing a booting pod down discards its /workspace and
 * guarantees another cold boot (a self-reinforcing false-degrade loop).
 */
export const BootBudgetMs = 12 * 60_000
/**
 * Backend-boot grace: for this long AFTER the watchdog itself (re)starts, a
 * PRESENT resident pod whose heartbeat is stale is NOT torn down. A deploy
 * restarts the backend, and while it is down the resident cannot dispatch its
 * 30s heartbeat, so `resident_status` goes stale — but the resident POD is a
 * separate K8s pod (restartPolicy:Never + in-pod supervisor) that survived and
 * resumes beating within ~30s of the backend returning. The watchdog's
 * per-agent start memory (`lastStartAt`) is in-memory and lost on the backend
 * restart, so without this grace the fresh backend sees "present pod + stale
 * heartbeat" and needlessly tears down a healthy resident on EVERY deploy
 * (turnCount reset, session continuity + any in-flight turn lost). Longer than
 * one stale window so a healthy resident re-registers a fresh beat first.
 *
 * MUST strictly exceed the backend's own startupProbe ceiling — the anchor is
 * the watchdog's start, which can fire early in a boot that itself runs minutes
 * (deploy/devspace.yaml gives the backend a 5-min startupProbe: 60 × 5s, with a
 * comment that boot "can exceed" tighter budgets). Set to 6 min = that 5-min
 * ceiling + a ~1-min margin for the resident to re-beat once the backend is
 * routable and for the next 60s tick to observe it, so a slow-but-healthy deploy
 * cannot churn a live resident. Keep it above devspace's startupProbe if either changes.
 */
export const BootGraceMs = 6 * 60_000
/** Crash-loop window: this many watchdog restarts inside an hour ⇒ degraded. */
export const CrashLoopWindowMs = 60 * 60_000
export const CrashLoopMaxRestarts = 3

/**
 * The pod env contract. MUST mirror repos/resident/src/constants.ts — the
 * runtime refuses to boot unless the five identity vars (agentId/token/
 * backendUrl/orgId/projectId) are present (readResidentEnv). `config` carries
 * the agent's resident_configs record as JSON so the runtime boots network-free
 * (the records API only REFRESHES it); `fallbacks` carries the ordered fallback
 * provider envs for in-pod failover (optional).
 */
export const ResidentEnvVars = {
  agentId: `TDSK_RESIDENT_AGENT_ID`,
  token: `TDSK_RESIDENT_TOKEN`,
  backendUrl: `TDSK_BACKEND_URL`,
  orgId: `TDSK_RESIDENT_ORG_ID`,
  projectId: `TDSK_RESIDENT_PROJECT_ID`,
  config: `TDSK_RESIDENT_CONFIG`,
  /** Ordered fallback provider envs (JSON) so the in-pod runtime fails over like the executor. Optional. */
  fallbacks: `TDSK_RESIDENT_PROVIDER_FALLBACKS`,
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
  bootBudgetMs?: number
  bootGraceMs?: number
  crashLoopWindowMs?: number
  crashLoopMaxRestarts?: number
  nowFn?: () => number
  /** Backend base URL override (defaults to the PUBLIC proxy URL, config.proxy.url). */
  backendUrl?: string
}

/** Hosts a sandbox pod can NEVER reach — loopback/wildcard binds of another machine. */
const PodUnreachableHosts = new Set([`0.0.0.0`, `localhost`, `127.0.0.1`, `::1`, `[::1]`])

/** True when the URL's host is a loopback/wildcard address (pod-unreachable). */
export const isPodUnreachableUrl = (url: string): boolean => {
  try {
    return PodUnreachableHosts.has(new URL(url).hostname)
  } catch {
    return false
  }
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
 * sandbox service WITH the full env contract (five identity vars + the
 * resident_configs record as TDSK_RESIDENT_CONFIG + the provider fallbacks). To
 * avoid tearing a healthy pod down on a transient error, the provider chain is
 * resolved and the new pod-scoped token CREATED (createResidentToken) BEFORE the
 * old pod is stopped — prior keys are revoked (revokeResidentKeysExcept) only
 * after the new pod starts, so the old pod keeps a valid token through its
 * shutdown. A crash-looping resident (≥3 watchdog restarts inside an hour,
 * tracked in-memory) is marked `degraded` and skipped until the hour rolls.
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
  const bootBudgetMs = opts.bootBudgetMs ?? BootBudgetMs
  const bootGraceMs = opts.bootGraceMs ?? BootGraceMs
  const crashLoopWindowMs = opts.crashLoopWindowMs ?? CrashLoopWindowMs
  const crashLoopMaxRestarts = opts.crashLoopMaxRestarts ?? CrashLoopMaxRestarts

  let timer: ReturnType<typeof setInterval> | undefined
  let current: Promise<TWatchdogSummary> | undefined
  let warnedNoSandbox = false
  let warnedUnreachableUrl = false
  /**
   * When THIS watchdog process started ticking — the anchor for the backend-boot
   * grace, set in start() (which the backend calls on boot). A deploy's
   * stale-heartbeat window must not tear down healthy residents whose pods
   * survived the backend restart. 0 until start() runs (so a watchdog only ever
   * driven via a direct tick(), i.e. tests, applies no grace by default).
   */
  let watchdogStartedAt = 0

  /** Watchdog-initiated restart timestamps per agent (the crash-loop window). */
  const restartLog = new Map<string, number[]>()
  /** Last watchdog-initiated pod start per agent (the startup grace). */
  const lastStartAt = new Map<string, number>()

  /**
   * Residents reach the backend via the PUBLIC proxy URL through the egress
   * MITM, exactly like any other client — there is no special in-cluster path.
   * Warns (once) when the configured URL is obviously unreachable from a pod
   * (loopback/wildcard host, e.g. the local-dev http://0.0.0.0:7118) — the
   * reconcile marks those residents degraded instead of crash-looping pods.
   */
  const resolveBackendUrl = (): string | undefined => {
    if (opts.backendUrl) return opts.backendUrl
    const url = app.locals.config?.proxy?.url || undefined
    if (url && isPodUnreachableUrl(url) && !warnedUnreachableUrl) {
      warnedUnreachableUrl = true
      logger.warn(
        `[ResidentWatchdog] config.proxy.url (TDSK_PX_URL) is ${url} — a loopback/wildcard address is unreachable from a sandbox pod. Residents will be marked degraded until TDSK_PX_URL is a pod-reachable URL.`
      )
    }
    return url
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

  /**
   * Clear a previously-set `degraded` flag once a resident is confirmed healthy.
   * The watchdog is the SOLE owner of `degraded` (the heartbeat merges over the
   * record and never writes it), so recovery is surfaced here. Only writes when
   * the flag is actually set, to avoid a DB write on every healthy tick.
   */
  const clearDegraded = async (
    projectId: string,
    agentId: string,
    statusRow?: { id: string; data?: Record<string, unknown> }
  ): Promise<void> => {
    if (!statusRow || statusRow.data?.degraded !== true) return
    const { db } = app.locals
    const { error } = await db.services.record.upsert(
      projectId,
      ResidentStatusCollection,
      { id: statusRow.id, data: { ...(statusRow.data ?? {}), agentId, degraded: false } }
    )
    if (error)
      logger.error(
        `[ResidentWatchdog] Failed to clear degraded for ${agentId}: ${error.message}`
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

      // Startup grace: skip re-checks entirely right after a (re)start, while
      // the pod may not even be listed by the K8s API yet.
      const startedAt = lastStartAt.get(agentId)
      if (!force && startedAt !== undefined && now - startedAt < startupGraceMs)
        return { ...base, action: `skipped`, reason: `startup grace` }

      const pods: string[] = await sandboxService!.findActiveInstances(
        sandboxId,
        agent.orgId
      )

      // Heartbeat freshness — the resident_status write time is the liveness
      // signal. Queried up front so both the healthy path and the boot-budget
      // check can use it.
      const { data: statusRows } = await db.services.record.query(
        projectId,
        ResidentStatusCollection,
        { where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }], limit: 1 }
      )
      const statusRow = statusRows?.[0]
      const hbAt = statusRow?.updatedAt ? new Date(statusRow.updatedAt).getTime() : 0
      const fresh = Boolean(hbAt && now - hbAt < staleMs)

      if (!force && pods.length && fresh) {
        // Confirmed live — the watchdog owns `degraded`, so clear it on recovery.
        await clearDegraded(projectId, agentId, statusRow)
        return { ...base, action: `healthy` }
      }

      // Boot budget: a present pod that has NOT heartbeated since we started it
      // is still cloning/building — do NOT tear it down (that discards its
      // /workspace clone + build and guarantees another cold boot). Only fall
      // through to a (re)start once the boot budget elapses, or a pod that DID
      // beat has since gone stale.
      if (!force && pods.length) {
        const beatSinceStart = hbAt > (startedAt ?? 0)
        if (!beatSinceStart && startedAt !== undefined && now - startedAt < bootBudgetMs)
          return {
            ...base,
            action: `skipped`,
            reason: `booting (no heartbeat yet, within boot budget)`,
          }
      }

      // Backend-boot grace: right after THIS backend (re)started, a present pod
      // with a stale heartbeat is almost certainly a resident whose pod SURVIVED
      // the backend restart but could not dispatch its heartbeat while the
      // backend was down. Do NOT tear it down — it re-beats within ~30s of the
      // backend returning and the next tick confirms it healthy. Only a pod that
      // is STILL stale after this grace (a genuinely wedged runtime) falls
      // through to a restart. `lastStartAt` is in-memory and lost on the backend
      // restart, so this grace — anchored on the watchdog's own start time — is
      // what stops the healthy-resident churn on every deploy.
      if (!force && pods.length && now - watchdogStartedAt < bootGraceMs)
        return {
          ...base,
          action: `skipped`,
          reason: `backend-boot grace (present pod; heartbeat may be stale from the backend restart)`,
        }

      const backendUrl = resolveBackendUrl()
      if (!backendUrl)
        return {
          ...base,
          action: `error`,
          reason: `no backend URL (config.proxy.url / TDSK_PX_URL unset)`,
        }

      // A loopback/wildcard proxy URL (local-dev http://0.0.0.0:7118) can
      // never be dialed from a pod — degrade with a clear reason instead of
      // starting a pod that would crash-loop on an unreachable backend.
      if (isPodUnreachableUrl(backendUrl)) {
        await markDegraded(projectId, agentId)
        return {
          ...base,
          action: `degraded`,
          reason: `config.proxy.url ${backendUrl} is unreachable from a pod (loopback/wildcard host) — set TDSK_PX_URL to a pod-reachable URL`,
        }
      }

      // Resolve the ai-provider failover chain FIRST — before any teardown or
      // restart accounting. The primary (priority-0) env is the pod default so
      // the resident's `claude -p` authenticates against a FUNDED provider;
      // every provider's placeholder is injected so egress can swap whichever
      // token an attempt uses; the ordered fallbacks ride the pod env so the
      // in-pod runtime fails over exactly like the scheduled executor. A
      // misconfigured provider throws → degrade with the running pod + its
      // token still intact (never tear down for a transient resolution error).
      let providerChain: TSandboxChain
      try {
        providerChain = (
          await resolveSandboxProviderChain(db, {
            orgId: agent.orgId,
            sandboxId,
            projectId,
            logContext: `[ResidentWatchdog] ${agentId} —`,
          })
        ).chain
      } catch (chainErr) {
        const reason = chainErr instanceof Error ? chainErr.message : String(chainErr)
        logger.error(
          `[ResidentWatchdog] Provider chain resolution failed for ${agentId}: ${reason}`
        )
        await markDegraded(projectId, agentId)
        return {
          ...base,
          action: `degraded`,
          reason: `provider auth misconfigured: ${reason}`,
        }
      }

      // Create the fresh pod-scoped token BEFORE teardown (create-only, no
      // revoke yet) so the OLD pod keeps a valid token through its graceful
      // shutdown checkpoint. If this throws, nothing has been torn down.
      const { key, apiKey } = await createResidentToken(db, agent.orgId, agentId)

      // Now committed to a (re)start: count it toward the crash-loop window and
      // grace-protect the agent, so even a startPod failure backs off instead
      // of churning K8s every tick (rolling restarts never count).
      if (!force) {
        restarts.push(now)
        restartLog.set(agentId, restarts)
      }
      lastStartAt.set(agentId, now)

      // Tear down stale pods (the old pod keeps its still-active token through
      // its graceful-shutdown checkpoint window — ResidentTerminationGrace
      // Seconds, matching the pod spec), then start the fresh pod.
      for (const staleId of pods) {
        await sandboxService!
          .stopPod(staleId, ResidentTerminationGraceSeconds)
          .catch((err: Error) =>
            logger.error(
              `[ResidentWatchdog] Failed to stop stale pod ${staleId}: ${err.message}`
            )
          )
      }

      const instanceId = await sandboxService!.startPod({
        orgId: agent.orgId,
        userId: sandboxRow.userId ?? ``,
        sandboxId,
        projectId,
        egressOpts: app.locals.config.egress,
        // Provider primary env — the pod default auth. Disjoint from the
        // resident identity vars below (TDSK_RESIDENT_*); startPod applies this
        // first and the caller's extraEnv last, so neither clobbers the other.
        providerChain: {
          primaryEnv: providerChain.primaryEnv,
          placeholders: providerChain.placeholders,
        },
        extraEnv: {
          [ResidentEnvVars.agentId]: agentId,
          [ResidentEnvVars.token]: key,
          [ResidentEnvVars.backendUrl]: backendUrl,
          [ResidentEnvVars.orgId]: agent.orgId,
          [ResidentEnvVars.projectId]: projectId,
          // The resident_configs record, injected so boot is network-free —
          // the runtime refreshes from the records API AFTER it is up.
          [ResidentEnvVars.config]: JSON.stringify(record.data ?? {}),
          // Ordered fallback provider envs (placeholder tokens + base URLs, all
          // egress-swappable) so the in-pod runtime fails over on a transient
          // primary failure — capped to match the executor's failover depth.
          [ResidentEnvVars.fallbacks]: JSON.stringify(
            providerChain.fallbacks
              .slice(0, CliMaxProviderFailovers)
              .map((fb) => ({ brand: fb.brand, env: fb.env }))
          ),
        },
      })

      // Old pod is gone → revoke every prior resident key except the new one.
      await revokeResidentKeysExcept(db, agentId, apiKey.id).catch((err: Error) =>
        logger.error(
          `[ResidentWatchdog] Failed to revoke prior resident keys for ${agentId}: ${err.message}`
        )
      )

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

    // One body per resident: an agent referenced by resident_configs in more
    // than one project must NOT be reconciled twice in a pass, or the two
    // passes would rotate each other's token + stop/start the same sandbox pod
    // (a tug-of-war). First record for an agentId wins.
    const seenAgents = new Set<string>()

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
        const aId =
          typeof record.data?.agentId === `string` ? (record.data.agentId as string) : ``
        if (aId && seenAgents.has(aId)) {
          logger.warn(
            `[ResidentWatchdog] Duplicate resident_configs for agent ${aId} in project ${collection.projectId} — skipping (one body per resident)`
          )
          continue
        }
        if (aId) seenAgents.add(aId)
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
      watchdogStartedAt = nowFn()
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
