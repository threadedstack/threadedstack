import type { TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { DbReleaseSpawnTimeoutMS } from '@TSCL/constants'

export type TReconcileResident = {
  log?: boolean
  config: TTaskActionArgs[`config`]
}

/**
 * Deploy-time reconcile of the resident data plane: runs the database repo's
 * `reconcile:resident` script (idempotent create of the resident Collections,
 * drift-update of the resident effect Functions, and create-or-update of the
 * activated residents' configs from git-versioned seeds — an agent-evolved
 * config is left untouched). Runs on every real release so a resident
 * capability or prompt change reaches the live residents, mirroring the
 * schedule reconcile.
 *
 * Non-fatal by design — a sync hiccup must NEVER roll back an otherwise-healthy
 * deploy; the next release retries. Failures are logged, not thrown.
 */
export const reconcileResident = async (opts: TReconcileResident): Promise<void> => {
  const { config, log } = opts

  try {
    const code = await dbSpawn({
      script: `reconcile:resident`,
      config,
      log,
      timeoutMs: DbReleaseSpawnTimeoutMS,
    })
    if (code !== 0)
      Logger.warn(
        `  Resident reconcile reported issues (exit ${code}); deploy continues — review the log above.`
      )
  } catch (err) {
    Logger.warn(
      `  Resident reconcile failed: ${(err as Error).message}; deploy continues.`
    )
  }
}
