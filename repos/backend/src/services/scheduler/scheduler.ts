import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { Schedule } from '@tdsk/domain'
import { isFeatureEnabled, parseNextRun } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { hydrateOrphanedRuns } from '@TBE/services/scheduler/rehydrator'

/**
 * Callback type for executing a scheduled agent run.
 * The backend wires up the actual implementation that creates an AgentRunner,
 * runs a turn with the schedule's prompt, and cleans up afterward.
 */
export type TScheduleExecutor = (schedule: Schedule) => Promise<void>

/**
 * Thrown by the executor when it loses the atomic cross-replica claim on a
 * due schedule's "running" slot (see ScheduleRun.claimRunning) — another
 * backend replica already started this schedule's run. This is an EXPECTED,
 * benign outcome of two replicas racing the same due schedule, never a real
 * failure, so `#processSchedule` must not increment the schedule's
 * consecutive-error count for it.
 */
export class ScheduleClaimConflictError extends Error {
  constructor(scheduleId: string) {
    super(`Schedule ${scheduleId} — running slot already claimed by another replica`)
    this.name = `ScheduleClaimConflictError`
  }
}

/**
 * Tick cadences. Active is the normal 60s poll. Idle kicks in when zero
 * enabled schedules exist — the per-minute poll was keeping the Neon compute
 * awake (and billing CU-hours) 24/7 even with every schedule disabled. Idle
 * is a slow heartbeat rather than a full stop because schedules can be
 * enabled by direct DB writes that never touch the API (e.g. `tdsk fleet on`
 * via toggleFleet.ts) — the heartbeat is the only thing that notices those.
 */
export const ActiveTickMs = 60_000
export const IdleTickMs = 30 * 60_000

export class Scheduler {
  private db: TDatabase
  private app: TApp | null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private executeAgent: TScheduleExecutor | null = null
  #ticking = false
  #tickMs: number = ActiveTickMs

  constructor(db: TDatabase, executeAgent?: TScheduleExecutor, app?: TApp) {
    this.db = db
    this.executeAgent = executeAgent ?? null
    this.app = app ?? null
  }

  /**
   * Start the scheduler — ticks every 60 seconds to check for due schedules.
   */
  start() {
    if (!isFeatureEnabled('schedules')) {
      logger.info(`[Scheduler] Schedules feature is disabled — not starting`)
      return
    }

    if (this.intervalId) {
      logger.warn(`[Scheduler] Already running`)
      return
    }

    logger.info(`[Scheduler] Starting scheduler (${ActiveTickMs / 1000}s tick interval)`)
    // A run executes in-process, so any run still `running` at boot outlived
    // the previous backend (a deploy restart, an OOM, a crash). The pod itself
    // may still be up and the runtime may already be done — mark honestly
    // instead of blanket-failing. `hydrateOrphanedRuns` inspects each pod and
    // completes the run based on its actual state (success / error / timeout),
    // dispatching a background watcher for pods that are still Running so we
    // wait for the runtime to finish rather than killing in-flight work.
    if (this.app)
      hydrateOrphanedRuns(this.app).catch((err) =>
        logger.error(`[Scheduler] Orphaned-run hydration failed: ${err}`)
      )
    else
      logger.warn(
        `[Scheduler] No app reference — skipping orphaned-run hydration (running rows will stay running until next boot with app wired in)`
      )
    // Run an initial tick immediately
    this.tick().catch((err) => logger.error(`[Scheduler] Initial tick failed: ${err}`))
    this.#setCadence(ActiveTickMs)
  }

  /**
   * (Re)create the tick interval at the given cadence. No-op when the
   * interval already runs at that cadence so repeated ticks in the same mode
   * don't churn timers.
   */
  #setCadence(tickMs: number) {
    if (this.intervalId && this.#tickMs === tickMs) return
    if (this.intervalId) clearInterval(this.intervalId)
    this.#tickMs = tickMs
    this.intervalId = setInterval(() => {
      this.tick().catch((err) => logger.error(`[Scheduler] Periodic tick failed: ${err}`))
    }, tickMs)
  }

  /**
   * Restore the active cadence and tick immediately. Called by the schedules
   * API whenever a schedule is created, enabled, or triggered so an idle
   * scheduler picks the new schedule up right away instead of waiting out the
   * idle heartbeat.
   */
  wake() {
    if (!this.intervalId) return
    if (this.#tickMs !== ActiveTickMs) {
      logger.info(`[Scheduler] Woken — resuming ${ActiveTickMs / 1000}s tick cadence`)
      this.#setCadence(ActiveTickMs)
    }
    this.tick().catch((err) => logger.error(`[Scheduler] Wake tick failed: ${err}`))
  }

  /**
   * Stop the scheduler.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info(`[Scheduler] Stopped`)
    }
  }

  async #processSchedule(schedule: Schedule) {
    try {
      logger.info(
        `[Scheduler] Schedule ${schedule.id} is due — sandbox=${schedule.sandboxId}, type=${schedule.type}, cron="${schedule.cronExpression}"`
      )

      // Serialize per-schedule: refuse to start a new run when one is already
      // in flight. Without this, a manual trigger during a slow executor would
      // let the natural cron slot fire ANOTHER concurrent run — that is what
      // let two coding cycles pick the same task and open duplicate PRs on
      // the same files. Advance next_run_at anyway so the schedule doesn't
      // stay wedged; the currently-running run's own completion path will
      // recompute correctly, and the next natural slot fires on schedule.
      const { data: hasRunning, error: hasRunningErr } =
        await this.db.services.scheduleRun.hasRunning(schedule.id)
      if (hasRunningErr) {
        logger.error(
          `[Scheduler] Skipping ${schedule.id} — hasRunning check failed: ${hasRunningErr.message}`
        )
        return
      }
      if (hasRunning) {
        logger.info(
          `[Scheduler] Schedule ${schedule.id} skipped — a prior run is still in flight; advancing next_run_at only`
        )
        const skipNext = parseNextRun(schedule.cronExpression)
        await this.db.services.schedule
          .markRun(schedule.id, skipNext)
          .catch((err) =>
            logger.error(
              `[Scheduler] Failed to advance next_run_at for skipped ${schedule.id}: ${err?.message || err}`
            )
          )
        return
      }

      const nextRunAt = parseNextRun(schedule.cronExpression)

      const { error: markErr } = await this.db.services.schedule.markRun(
        schedule.id,
        nextRunAt
      )
      if (markErr) {
        logger.error(
          `[Scheduler] Failed to advance nextRunAt for schedule ${schedule.id} — skipping execution: ${markErr.message}`
        )
        return
      }

      if (this.executeAgent) {
        await this.executeAgent(schedule)
        await this.db.services.schedule.resetErrors(schedule.id)
        logger.info(
          `[Scheduler] Schedule ${schedule.id} completed, next run at ${nextRunAt.toISOString()}`
        )
      }
    } catch (err: any) {
      if (err instanceof ScheduleClaimConflictError) {
        logger.info(
          `[Scheduler] Schedule ${schedule.id} — lost the atomic claim race to another replica; skipping cleanly`
        )
        return
      }
      logger.error(
        `[Scheduler] Error processing schedule ${schedule.id}: ${err?.message || err}`
      )
      try {
        await this.db.services.schedule.incrementErrors(schedule.id)
      } catch (incErr: any) {
        logger.error(
          `[Scheduler] Failed to increment errors for schedule ${schedule.id}: ${incErr?.message || incErr}`
        )
      }
    }
  }

  /**
   * Check for due schedules and process them.
   *
   * Fires executors WITHOUT awaiting them. The old shape used
   * `await Promise.allSettled(dueSchedules.map(processSchedule))`, which meant
   * a single long-running executor (a CLI-brain run taking 10+ minutes)
   * blocked the tick — and because #ticking is set for the whole tick, every
   * subsequent 60s tick would bail via `if (this.#ticking) return` and no new
   * schedules would be picked up until the slowest current executor finished.
   * That is how the coding cycle went dark whenever an adversary review was
   * still in flight: the trigger row got created, but the tick that would
   * have processed the coding cycle was serialized behind an unrelated
   * long-running schedule.
   *
   * #processSchedule advances next_run_at synchronously via markRun BEFORE
   * awaiting the executor, so a fire-and-forget dispatch here does not cause
   * the same schedule to be picked up twice by the next tick.
   */
  async tick() {
    if (this.#ticking) return
    this.#ticking = true
    try {
      const { data: dueSchedules, error } = await this.db.services.schedule.listDue()

      if (error) {
        logger.error(`[Scheduler] Error fetching due schedules: ${error.message}`)
        return
      }

      if (!dueSchedules || dueSchedules.length === 0) {
        await this.#adjustCadence()
        return
      }

      // Due work exists, so enabled schedules exist — make sure we're on the
      // active cadence (an idle heartbeat can land here when schedules were
      // enabled by a direct DB write that never called wake()). Guarded on
      // intervalId so a bare tick() on a never-started scheduler stays
      // timer-free.
      if (this.intervalId) this.#setCadence(ActiveTickMs)

      logger.info(`[Scheduler] Found ${dueSchedules.length} due schedule(s)`)

      for (const schedule of dueSchedules) {
        // Fire and forget. Errors are logged inside #processSchedule's own
        // catch; the .catch here is a belt-and-suspenders guard against any
        // throw that escapes #processSchedule (which shouldn't happen but
        // would otherwise become an unhandled rejection).
        this.#processSchedule(schedule).catch((err) =>
          logger.error(
            `[Scheduler] Unhandled error in processSchedule ${schedule.id}: ${err?.message || err}`
          )
        )
      }
    } catch (err: any) {
      logger.error(`[Scheduler] Tick error: ${err?.message || err}`)
    } finally {
      this.#ticking = false
    }
  }

  /**
   * Called on ticks that found no due work: back off to the idle heartbeat
   * when zero enabled schedules exist, or restore the active cadence when an
   * idle heartbeat discovers schedules were enabled behind the API's back.
   * On a failed check, keep the current cadence — never idle on uncertainty.
   */
  async #adjustCadence() {
    if (!this.intervalId) return

    const { data: hasEnabled, error } = await this.db.services.schedule.hasEnabled()
    if (error) {
      logger.error(`[Scheduler] hasEnabled check failed: ${error.message}`)
      return
    }

    if (!hasEnabled && this.#tickMs !== IdleTickMs) {
      logger.info(
        `[Scheduler] No enabled schedules — backing off to ${IdleTickMs / 60_000}m idle heartbeat`
      )
      this.#setCadence(IdleTickMs)
    } else if (hasEnabled && this.#tickMs !== ActiveTickMs) {
      logger.info(
        `[Scheduler] Enabled schedule(s) found while idle — resuming ${ActiveTickMs / 1000}s tick cadence`
      )
      this.#setCadence(ActiveTickMs)
    }
  }
}

/**
 * Factory function to create a Scheduler instance.
 */
export function createScheduler(
  db: TDatabase,
  executeAgent?: TScheduleExecutor,
  app?: TApp
): Scheduler {
  return new Scheduler(db, executeAgent, app)
}
