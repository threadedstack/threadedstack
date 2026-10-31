import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'

const RETENTION_TICK_MS = 24 * 60 * 60 * 1000

export class RetentionCleanup {
  private db: TDatabase
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(db: TDatabase) {
    this.db = db
  }

  /**
   * Start the retention cleanup — runs immediately, then every 24h.
   */
  start() {
    if (this.intervalId) {
      logger.warn(`[RetentionCleanup] Already running`)
      return
    }

    logger.info(`[RetentionCleanup] Starting retention cleanup (24h tick interval)`)
    this.run()
    this.intervalId = setInterval(() => {
      this.run()
    }, RETENTION_TICK_MS)
  }

  /**
   * Stop the retention cleanup.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info(`[RetentionCleanup] Stopped`)
    }
  }

  private async run() {
    try {
      const results = await this.db.services.thread.pruneExpiredThreads()
      const totalDeleted = results.reduce((sum, r) => sum + r.deletedThreadIds.length, 0)
      logger.info(
        `[RetentionCleanup] Pruned ${totalDeleted} expired thread(s) across ${results.length} org(s)`
      )
    } catch (err) {
      logger.error(`[RetentionCleanup] Prune run failed:`, (err as Error).message)
    }
  }
}

/**
 * Factory function to create a RetentionCleanup instance.
 */
export function createRetentionCleanup(db: TDatabase): RetentionCleanup {
  return new RetentionCleanup(db)
}
