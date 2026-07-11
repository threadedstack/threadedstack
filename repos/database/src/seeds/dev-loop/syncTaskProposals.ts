import type { TAnyObj } from '@tdsk/domain'
import type { TDBTaskProposalSelect } from '@TDB/types'

import { stableStringify } from '@TDB/seeds/reconcileSchedules'

/**
 * Dev-loop `task_proposals` table -> Collection sync (⑤b-4a).
 *
 * Idempotently copies every row of the legacy `task_proposals` TABLE into the
 * `task_proposals` COLLECTION in the ops project, so record-vs-row parity is
 * observable while the work cycle DUAL-EMITS its pickups (the table stays
 * authoritative through the transition). This is a PERSISTENT, rerunnable sync,
 * not a one-shot seed: it runs at the 4a cutover and again at 4b, and any
 * re-run in between must be a no-op for unchanged rows.
 *
 * Mapping (table column -> record document field):
 * - `id` -> the RECORD id itself (identity — deterministic, the way the
 *   exec-board seeds used fixed `rec_` ids; both tables share IdLength=10, so a
 *   `tp_` id is a valid record id). This is load-bearing: the `pickupTask`
 *   Function locates a proposal ONLY via `records.get('task_proposals', args.proposalId)`
 *   (seeds/dev-loop/functions/pickupTask.ts — no dedupeKey lookup), and during
 *   4a the work cycle only sees `tp_` ids from the legacy backlog builder, so
 *   the record id MUST equal the table id for the dual-emit to correlate.
 * - `id` -> ALSO kept inside the document as `legacyId`, the stable re-run
 *   upsert key that survives even if a future phase re-keys the records.
 * - `agentId` -> `proposedByAgentId` (the ⑤b-2 collection names the trusted
 *   caller for its semantics — seeds/dev-loop/collections.ts).
 * - `orgId` + base `createdAt`/`updatedAt` -> DROPPED (the record's project
 *   scope and own timestamps replace them).
 * - Every other data column copies 1:1; nullable columns are OMITTED when null
 *   so the stableStringify drift compare stays stable across re-runs.
 *
 * Pure and DB-agnostic (injected record-service slice), the same testable shape
 * as `reconcileDevLoop`; the runner in `scripts/syncTaskProposals.ts` wires it
 * to the real table + record service. Never throws — every outcome lands in
 * the summary.
 *
 * `projectId` is a REQUIRED argument (no `OpsProjectId` default): keeping this
 * module free of a value import from `seeds/agentSchedules` (which reads the
 * prompt `.md` files from disk at module-evaluation time) lets the backend
 * import the pure single-row mapper for its best-effort table->collection
 * mirror without dragging that file-system side effect into its tsup bundle.
 */

/** The record-service slice the sync needs (project+collection-scoped get/upsert). */
export type TSyncRecordService = {
  get: (
    projectId: string,
    collectionName: string,
    id: string
  ) => Promise<{ data?: { id: string; data: TAnyObj }; error?: any }>
  upsert: (
    projectId: string,
    collectionName: string,
    input: { id?: string; data: TAnyObj }
  ) => Promise<{ data?: any; error?: any }>
}

export type TSyncAction = `created` | `updated` | `unchanged` | `error`

export type TSyncSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: { id: string; action: TSyncAction; message?: string }[]
}

/** The collection the sync writes — the ⑤b-2 `task_proposals` Collection. */
export const TaskProposalsCollectionName = `task_proposals`

/**
 * Deterministic record id for a table row: the table id itself (see module doc
 * — required so `pickupTask`'s `records.get` resolves the `tp_` ids the legacy
 * backlog context injects during the dual-emit transition).
 */
export const taskProposalRecordId = (row: Pick<TDBTaskProposalSelect, `id`>): string =>
  row.id

/**
 * Map a table row to its collection document. Drops orgId + base timestamps,
 * renames `agentId` -> `proposedByAgentId`, keeps the table id as `legacyId`,
 * and omits null optional columns for a stable drift compare.
 */
export const taskProposalRecordData = (row: TDBTaskProposalSelect): TAnyObj => {
  const optional = (name: string, value: unknown) =>
    value === null || value === undefined ? {} : { [name]: value }

  return {
    legacyId: row.id,
    title: row.title,
    description: row.description,
    evidence: row.evidence,
    dedupeKey: row.dedupeKey,
    status: row.status,
    proposedByAgentId: row.agentId,
    ...optional(`priority`, row.priority),
    ...optional(`sourceSignal`, row.sourceSignal),
    ...optional(`repos`, row.repos),
    ...optional(`scanResult`, row.scanResult),
    ...optional(`auditVerdict`, row.auditVerdict),
    ...optional(`meta`, row.meta),
    ...optional(`prUrl`, row.prUrl),
    ...optional(`reason`, row.reason),
    ...optional(`initiative`, row.initiative),
    ...optional(`parentId`, row.parentId),
  }
}

/**
 * Idempotently sync ONE table row into the collection: missing record -> create,
 * drifted document (stableStringify compare) -> replace, else unchanged. The
 * single-row unit both the batch `syncTaskProposalRecords` loop (deploy backfill)
 * and the backend's best-effort per-write mirror (`taskProposalMirror.ts`) share,
 * so the mapping + drift compare + create/update/unchanged decision live in ONE
 * place. Resolves every outcome to a `{ id, action, message? }` result and never
 * throws — a thrown error from the injected service is caught and returned as an
 * `error` action.
 */
export const syncTaskProposalRecord = async (
  service: TSyncRecordService,
  row: TDBTaskProposalSelect,
  projectId: string
): Promise<{ id: string; action: TSyncAction; message?: string }> => {
  const recordId = taskProposalRecordId(row)
  try {
    const data = taskProposalRecordData(row)

    const existing = await service.get(projectId, TaskProposalsCollectionName, recordId)
    if (existing.error)
      return {
        id: recordId,
        action: `error`,
        message: `get failed: ${existing.error.message}`,
      }

    if (existing.data && stableStringify(existing.data.data) === stableStringify(data))
      return { id: recordId, action: `unchanged` }

    const res = await service.upsert(projectId, TaskProposalsCollectionName, {
      id: recordId,
      data,
    })
    if (res.error)
      return {
        id: recordId,
        action: `error`,
        message: `upsert failed: ${res.error.message}`,
      }

    return { id: recordId, action: existing.data ? `updated` : `created` }
  } catch (err: any) {
    return { id: recordId, action: `error`, message: err?.message }
  }
}

/**
 * Idempotently sync table rows into the collection: missing record -> create,
 * drifted document (stableStringify compare) -> replace, else unchanged. A
 * re-run over unchanged rows writes nothing. `projectId` is required — see the
 * module doc.
 */
export const syncTaskProposalRecords = async (
  service: TSyncRecordService,
  rows: TDBTaskProposalSelect[],
  projectId: string,
  log: (msg: string) => void = () => {}
): Promise<TSyncSummary> => {
  const summary: TSyncSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const glyph: { [K in TSyncAction]: string } = {
    created: `✅`,
    updated: `🔄`,
    unchanged: `➖`,
    error: `❌`,
  }

  for (const row of rows) {
    const result = await syncTaskProposalRecord(service, row, projectId)
    if (result.action === `error`) {
      summary.errors++
      summary.results.push({ id: result.id, action: `error`, message: result.message })
      log(`  ${glyph.error} ${result.id} — ${result.message ?? `unknown error`}`)
      continue
    }

    summary[result.action]++
    summary.results.push({ id: result.id, action: result.action })
    log(`  ${glyph[result.action]} ${result.id} — ${result.action}`)
  }

  return summary
}
