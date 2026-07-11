import type { TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'

export type TReconcileDevTeam = {
  log?: boolean
  config: TTaskActionArgs[`config`]
}

/**
 * Deploy-time reconcile of the realtime dev-team data plane: runs the database
 * repo's `reconcile:dev-team` script (idempotent create of the `dev_tasks`
 * Collection and drift-update of the ten dev-team state-machine Functions —
 * devClaimTask/devSubmitPr/devClaimReview/devCompleteReview/devMarkMerged/
 * devUpdatePr/devRenewLease/devAddTask/devReapExpired/devAbandon — into the live
 * ops project). Runs on every real release so a Function-source change (e.g. the
 * devAddTask sourceTaskProposalId dedupe) reaches prod through the normal
 * deploy pipeline, mirroring the schedule + dev-loop + resident reconcile.
 *
 * Ordered alongside `reconcileDevLoop` (before the resident reconcile): the
 * `dev_tasks` Collection + Functions the resident configs reference must exist
 * before the resident data plane is reconciled.
 *
 * Non-fatal by design — a sync hiccup must NEVER roll back an otherwise-healthy
 * deploy; the next release retries. Failures are logged, not thrown.
 */
export const reconcileDevTeam = async (opts: TReconcileDevTeam): Promise<void> => {
  const { config, log } = opts

  try {
    const code = await dbSpawn({ script: `reconcile:dev-team`, config, log })
    if (code !== 0)
      Logger.warn(
        `  Dev-team reconcile reported issues (exit ${code}); deploy continues — review the log above.`
      )
  } catch (err) {
    Logger.warn(
      `  Dev-team reconcile failed: ${(err as Error).message}; deploy continues.`
    )
  }
}
