import type { TDatabase } from '@tdsk/database'
import type { Schedule } from '@tdsk/domain'
import { isFeatureEnabled } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { parseNextRun } from '@TBE/services/scheduler/cronParser'

/**
 * Callback type for executing a scheduled agent run.
 * The backend wires up the actual implementation that creates an AgentRunner,
 * runs a turn with the schedule's prompt, and cleans up afterward.
 */
export type TScheduleExecutor = (schedule: Schedule) => Promise<void>

export class Scheduler {
  private db: TDatabase
  private intervalId: ReturnType<typeof setInterval> | null = null
  private executeAgent: TScheduleExecutor | null = null
  #ticking = false

  constructor(db: TDatabase, executeAgent?: TScheduleExecutor) {
    this.db = db
    this.executeAgent = executeAgent ?? null
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

    logger.info(`[Scheduler] Starting scheduler (60s tick interval)`)
    // A run executes in-process, so any run still `running` at boot was orphaned
    // by the previous process dying (a deploy restart mid-run) — its executor is
    // gone and can neither finish it nor enforce its timeout. Reap before ticking
    // so those rows don't linger as permanent `running` and the failure is recorded.
    this.#reapOrphanedRuns().catch((err) =>
      logger.error(`[Scheduler] Orphaned-run reap failed: ${err}`)
    )
    // Run an initial tick immediately
    this.tick().catch((err) => logger.error(`[Scheduler] Initial tick failed: ${err}`))
    this.intervalId = setInterval(() => {
      this.tick().catch((err) => logger.error(`[Scheduler] Periodic tick failed: ${err}`))
    }, 60_000)
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

  async #reapOrphanedRuns() {
    const { data, error } = await this.db.services.scheduleRun.failOrphaned(
      `Orphaned by backend restart — the executor process died mid-run (e.g. a deploy)`
    )
    if (error) {
      logger.error(`[Scheduler] Failed to reap orphaned runs: ${error.message}`)
      return
    }
    if (data?.count)
      logger.warn(
        `[Scheduler] Reaped ${data.count} orphaned run(s) left in "running" at startup: ${data.ids.join(`, `)}`
      )
  }

  async #processSchedule(schedule: Schedule) {
    try {
      logger.info(
        `[Scheduler] Schedule ${schedule.id} is due — sandbox=${schedule.sandboxId}, type=${schedule.type}, cron="${schedule.cronExpression}"`
      )

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

      if (!dueSchedules || dueSchedules.length === 0) return

      logger.info(`[Scheduler] Found ${dueSchedules.length} due schedule(s)`)

      const results = await Promise.allSettled(
        dueSchedules.map((schedule) => this.#processSchedule(schedule))
      )

      const failures = results.filter((r) => r.status === `rejected`)
      if (failures.length > 0) {
        logger.warn(
          `[Scheduler] ${failures.length}/${dueSchedules.length} schedule(s) failed in tick`
        )
      }
    } catch (err: any) {
      logger.error(`[Scheduler] Tick error: ${err?.message || err}`)
    } finally {
      this.#ticking = false
    }
  }
}

/**
 * Factory function to create a Scheduler instance.
 */
export function createScheduler(
  db: TDatabase,
  executeAgent?: TScheduleExecutor
): Scheduler {
  return new Scheduler(db, executeAgent)
}
