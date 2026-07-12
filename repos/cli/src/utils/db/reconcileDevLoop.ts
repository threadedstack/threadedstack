import type { TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { DbReleaseSpawnTimeoutMS } from '@TSCL/constants'

export type TReconcileDevLoop = {
  log?: boolean
  config: TTaskActionArgs[`config`]
}

/**
 * Deploy-time reconcile of the dev-loop workflow data plane: runs the database
 * repo's `reconcile:dev-loop` script (idempotent create of the three workflow
 * Collections — task_proposals / verifications / escalations — and drift-update
 * of the five dev-loop effect Functions proposeTask/pickupTask/openEscalation/
 * resolveEscalation/recordVerification into the live ops project). Runs on every
 * real release so the resident-facing `task_proposals` Collection and its
 * Functions exist and stay current, mirroring the schedule + resident reconcile.
 *
 * Ordered BEFORE `syncTaskProposals`: the Collection must exist before the
 * backfill writes any row into it.
 *
 * Non-fatal by design — a sync hiccup must NEVER roll back an otherwise-healthy
 * deploy; the next release retries. Failures are logged, not thrown.
 */
export const reconcileDevLoop = async (opts: TReconcileDevLoop): Promise<void> => {
  const { config, log } = opts

  try {
    const code = await dbSpawn({
      script: `reconcile:dev-loop`,
      config,
      log,
      timeoutMs: DbReleaseSpawnTimeoutMS,
    })
    if (code !== 0)
      Logger.warn(
        `  Dev-loop reconcile reported issues (exit ${code}); deploy continues — review the log above.`
      )
  } catch (err) {
    Logger.warn(
      `  Dev-loop reconcile failed: ${(err as Error).message}; deploy continues.`
    )
  }
}
