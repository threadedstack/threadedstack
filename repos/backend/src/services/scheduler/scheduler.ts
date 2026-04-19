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

      for (const schedule of dueSchedules) {
        try {
          logger.info(
            `[Scheduler] Schedule ${schedule.id} is due — agent=${schedule.agentId}, cron="${schedule.cronExpression}"`
          )

          const nextRunAt = parseNextRun(schedule.cronExpression)

          // Execute the agent if an executor was provided
          if (this.executeAgent) {
            await this.executeAgent(schedule)
            logger.info(`[Scheduler] Schedule ${schedule.id} agent execution completed`)
          }

          // Mark run ONLY after successful execution — prevents advancing nextRunAt on failure
          await this.db.services.schedule.markRun(schedule.id, nextRunAt)

          logger.info(
            `[Scheduler] Schedule ${schedule.id} marked as run, next run at ${nextRunAt.toISOString()}`
          )
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
