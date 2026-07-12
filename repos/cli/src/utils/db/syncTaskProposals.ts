import type { TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { DbReleaseSpawnTimeoutMS } from '@TSCL/constants'

export type TSyncTaskProposals = {
  log?: boolean
  config: TTaskActionArgs[`config`]
}

/**
 * Deploy-time backfill of the authoritative `task_proposals` TABLE into the
 * ops-project `task_proposals` COLLECTION: runs the database repo's
 * `sync:task-proposals` script (idempotent copy of every table row into the
 * Collection keyed by the row id, a no-op for unchanged rows). Runs on every
 * real release so the resident-facing Collection reflects the table at deploy
 * time; the backend's best-effort per-write mirror keeps it fresh between
 * deploys.
 *
 * Ordered AFTER `reconcileDevLoop`: the Collection must already exist before
 * this writes into it.
 *
 * Non-fatal by design — a sync hiccup must NEVER roll back an otherwise-healthy
 * deploy; the next release retries. Failures are logged, not thrown.
 */
export const syncTaskProposals = async (opts: TSyncTaskProposals): Promise<void> => {
  const { config, log } = opts

  try {
    const code = await dbSpawn({
      script: `sync:task-proposals`,
      config,
      log,
      timeoutMs: DbReleaseSpawnTimeoutMS,
    })
    if (code !== 0)
      Logger.warn(
        `  Task-proposal sync reported issues (exit ${code}); deploy continues — review the log above.`
      )
  } catch (err) {
    Logger.warn(
      `  Task-proposal sync failed: ${(err as Error).message}; deploy continues.`
    )
  }
}
