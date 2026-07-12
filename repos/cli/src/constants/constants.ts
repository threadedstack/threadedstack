import type { TEnvFilter } from '@TSCL/types'

export const DBEnvFilter: TEnvFilter = {
  add: [],
  ends: [],
  exclude: [],
  contains: [],
  starts: [`STL_FORCE_DISABLE_SAFE`, `TDSK_DB_`, `TDSK_LOG_LEVEL`],
}

/**
 * Upper bound for the release-pipeline's non-fatal dbSpawn() reconcile/sync
 * calls (reconcileResident/syncTaskProposals/reconcileDevTeam/reconcileDevLoop/
 * reconcileSchedules) -- these have no operator-visible bound otherwise, unlike
 * interactive dbSpawn() callers (db push/db studio) which intentionally stay
 * unbounded and must NOT pass this.
 */
export const DbReleaseSpawnTimeoutMS = 5 * 60 * 1000
