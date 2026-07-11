import type { TDatabase } from '@tdsk/database'
import type { TDBTaskProposalSelect } from '@TDB/types'

import { logger } from '@TBE/utils/logger'
import { syncTaskProposalRecord } from '@TDB/seeds/dev-loop/syncTaskProposals'

/**
 * Best-effort mirror of an authoritative `task_proposals` TABLE row into the
 * ops-project `task_proposals` COLLECTION, so the resident-facing surface (a
 * resident can only read Collections through its `contextSources`, never SQL
 * tables) tracks the table between deploys. The deploy pipeline's
 * `sync:task-proposals` step backfills the whole table; this keeps the two
 * fresh in the ~2h/hourly window between deploys by mirroring on every
 * authoritative mutation (`authorTaskProposal` create, `markTaskPromoted`
 * status change).
 *
 * BEST-EFFORT AND NON-AUTHORITATIVE: the TABLE is the source of truth. A
 * Collection-write failure is caught, logged at warn, and swallowed — it MUST
 * NEVER throw out of, or roll back, the authoritative table write that already
 * succeeded. The deploy-time backfill self-heals any row this misses.
 *
 * Reuses the single-row mapper + drift compare from the database repo's
 * `syncTaskProposalRecord` (the same code path the deploy backfill runs), so
 * the row->document mapping stays defined in exactly one place. That module is
 * import-safe here (no `readFileSync`-on-import side effect) precisely because
 * it takes `projectId` as an argument instead of importing it from
 * `seeds/agentSchedules`.
 */

/**
 * The ops project that owns the dev-loop workflow Collections. Canonical source
 * is `OpsProjectId` in `repos/database/src/seeds/agentSchedules.ts` (`pj_tIly2F1`);
 * the backend mirrors the literal here because importing that module would pull
 * its prompt-file `readFileSync` side effect into the tsup bundle. Wiring, not
 * product config — a wrong value only degrades the best-effort mirror (the
 * deploy backfill, which uses the canonical constant, remains the safety net).
 */
export const OpsProjectId = `pj_tIly2F1`

/**
 * Mirror one task-proposal row into the ops Collection. Never throws. `db` is
 * the live database whose `services.record` slice provides the project +
 * collection-scoped get/upsert the sync needs.
 */
export const mirrorTaskProposalToCollection = async (
  db: TDatabase,
  row: TDBTaskProposalSelect
): Promise<void> => {
  try {
    const result = await syncTaskProposalRecord(db.services.record, row, OpsProjectId)
    if (result.action === `error`)
      logger.warn(
        `[task] Collection mirror of proposal ${result.id} failed (table stays authoritative): ${
          result.message ?? `unknown`
        }`
      )
  } catch (err) {
    logger.warn(
      `[task] Collection mirror of proposal ${row.id} threw (table stays authoritative): ${
        (err as Error).message
      }`
    )
  }
}
