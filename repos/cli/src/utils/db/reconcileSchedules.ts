import type { TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { DbReleaseSpawnTimeoutMS } from '@TSCL/constants'

export type TReconcileSchedules = {
  log?: boolean
  config: TTaskActionArgs[`config`]
}

/**
 * Deploy-time reconcile of the agent's own operating schedules: runs the
 * database repo's `reconcile:schedules` script (idempotent upsert of prompt +
 * cadence from git-versioned config into the live `schedules` table).
 *
 * Non-fatal by design — a sync hiccup must NEVER roll back an otherwise-healthy
 * deploy; the next release retries. Failures are logged, not thrown.
 */
export const reconcileSchedules = async (opts: TReconcileSchedules): Promise<void> => {
  const { config, log } = opts

  try {
    const code = await dbSpawn({
      script: `reconcile:schedules`,
      config,
      log,
      timeoutMs: DbReleaseSpawnTimeoutMS,
    })
    if (code !== 0)
      Logger.warn(
        `  Schedule reconcile reported issues (exit ${code}); deploy continues — review the log above.`
      )
  } catch (err) {
    Logger.warn(
      `  Schedule reconcile failed: ${(err as Error).message}; deploy continues.`
    )
  }
}
