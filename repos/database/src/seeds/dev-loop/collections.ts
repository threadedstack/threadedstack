import type { TCollectionSchema } from '@tdsk/domain'

import { EFieldType } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'

/**
 * Dev-loop workflow Collections — Dev-Loop on Primitives (⑤b-2).
 *
 * Expresses the live dev-loop's use-case workflow state as Collections (①) in
 * the ops project, mirroring the hard-coded `task_proposals` / `verifications` /
 * `escalations` table columns 1:1. Additive and inert: no schedule invokes the
 * effect Functions that write these yet (that is the Phase 4 cutovers), and
 * there are NO seed records — the live rows are copied at cutover.
 *
 * `reconcileDevLoop` below is a pure, DB-agnostic upsert (injected service),
 * the same pattern as `reconcileExecBoard`, so it is unit-testable without a
 * live connection. The deploy runner in `scripts/reconcileDevLoop.ts` wires it
 * to the real collection service. Idempotent: an existing collection (keyed by
 * projectId+name) is left untouched, so a re-run creates nothing new.
 */

/** A dev-loop Collection definition: a stable id, name, description, and field schema. */
export type TDevLoopCollectionDef = {
  id: string
  name: string
  description: string
  schema: TCollectionSchema
}

/**
 * The three dev-loop workflow Collections. Each schema mirrors the columns of
 * the table it replaces 1:1 (data columns only — the `base` id/timestamps and
 * the org scope become the Collection's own record id + project scope). Fields
 * the source column marks NOT NULL are `required`; nullable columns are
 * optional. The tables' `agentId` column carries the trusted-caller identity,
 * so it is named for its semantics (proposedByAgentId / openedByAgentId) the
 * way decision_proposals named its opener — verifications keeps `agentId` (the
 * verifying agent).
 */
export const DevLoopCollectionDefs: TDevLoopCollectionDef[] = [
  {
    // task_proposals — mirrors repos/database/src/schemas/taskProposals.ts
    id: `col_tprop1`,
    name: `task_proposals`,
    description: `Self-sensed dev-loop task proposals — mirrors the task_proposals table (pending → scanned → promoted | rejected; the fail-closed content scan is the authoring gate, and scanned proposals ARE the work-cycle backlog).`,
    schema: [
      { name: `title`, type: EFieldType.string, required: true },
      { name: `description`, type: EFieldType.string, required: true },
      { name: `priority`, type: EFieldType.string },
      { name: `evidence`, type: EFieldType.string, required: true },
      { name: `sourceSignal`, type: EFieldType.string },
      { name: `dedupeKey`, type: EFieldType.string, required: true },
      { name: `repos`, type: EFieldType.array },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `scanResult`, type: EFieldType.object },
      { name: `auditVerdict`, type: EFieldType.object },
      { name: `meta`, type: EFieldType.object },
      { name: `prUrl`, type: EFieldType.string },
      { name: `reason`, type: EFieldType.string },
      { name: `initiative`, type: EFieldType.string },
      { name: `parentId`, type: EFieldType.string },
      { name: `proposedByAgentId`, type: EFieldType.string, required: true },
    ],
  },
  {
    // verifications — mirrors repos/database/src/schemas/verifications.ts
    id: `col_verif1`,
    name: `verifications`,
    description: `Post-merge verification rows for steward PRs — mirrors the verifications table (pending → verifying → verified | regressed; unique per prNumber; a regressed row links its filed escalation).`,
    schema: [
      { name: `prNumber`, type: EFieldType.number, required: true },
      { name: `prUrl`, type: EFieldType.string },
      { name: `mergeSha`, type: EFieldType.string },
      { name: `probe`, type: EFieldType.object, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `detail`, type: EFieldType.string },
      { name: `revertPrUrl`, type: EFieldType.string },
      { name: `escalationId`, type: EFieldType.string },
      { name: `meta`, type: EFieldType.object },
      { name: `agentId`, type: EFieldType.string, required: true },
    ],
  },
  {
    // escalations — mirrors repos/database/src/schemas/escalations.ts
    id: `col_escal1`,
    name: `escalations`,
    description: `Agent-opened dev-loop escalations — mirrors the escalations table (open → routed | resolved | rejected; secrets target is issue-only, app target auto-routes; dedupeKey collapses repeats).`,
    schema: [
      { name: `title`, type: EFieldType.string, required: true },
      { name: `problem`, type: EFieldType.string, required: true },
      { name: `evidence`, type: EFieldType.array },
      { name: `proposedPatch`, type: EFieldType.string },
      { name: `target`, type: EFieldType.string, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `dedupeKey`, type: EFieldType.string, required: true },
      { name: `issueRef`, type: EFieldType.string },
      { name: `resolvedRef`, type: EFieldType.string },
      { name: `reason`, type: EFieldType.string },
      { name: `meta`, type: EFieldType.object },
      { name: `openedByAgentId`, type: EFieldType.string, required: true },
    ],
  },
]

/** The collection-service slice the reconcile needs (create + name lookup). */
export type TDevLoopCollectionService = {
  getByName: (projectId: string, name: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TDevLoopSeedServices = {
  collection: TDevLoopCollectionService
}

export type TDevLoopSeedAction = `created` | `unchanged` | `error`

export type TDevLoopSeedSummary = {
  collectionsCreated: number
  collectionsUnchanged: number
  errors: number
  results: {
    name: string
    action: TDevLoopSeedAction
    message?: string
  }[]
}

/**
 * Idempotently seed the three dev-loop workflow Collections into the ops
 * project. Collections are created only when absent (keyed by projectId+name),
 * so a re-run makes no changes. There are NO seed records (live rows are
 * copied at the Phase 4 cutovers). Never throws — every outcome is captured in
 * the summary.
 */
export const reconcileDevLoop = async (
  services: TDevLoopSeedServices,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TDevLoopSeedSummary> => {
  const summary: TDevLoopSeedSummary = {
    collectionsCreated: 0,
    collectionsUnchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (name: string, message?: string) => {
    summary.errors++
    summary.results.push({ name, action: `error`, message })
    log(`  ❌ collection ${name} — ${message ?? `unknown error`}`)
  }

  for (const def of DevLoopCollectionDefs) {
    try {
      const existing = await services.collection.getByName(projectId, def.name)
      if (existing.error) {
        fail(def.name, `getByName failed: ${existing.error.message}`)
        continue
      }

      if (existing.data) {
        summary.collectionsUnchanged++
        summary.results.push({ name: def.name, action: `unchanged` })
        log(`  ➖ collection ${def.name} — unchanged`)
        continue
      }

      const res = await services.collection.create({
        id: def.id,
        name: def.name,
        description: def.description,
        schema: def.schema,
        projectId,
      })
      if (res.error) fail(def.name, `create failed: ${res.error.message}`)
      else {
        summary.collectionsCreated++
        summary.results.push({ name: def.name, action: `created` })
        log(`  ✅ collection ${def.name} — created`)
      }
    } catch (err: any) {
      fail(def.name, err?.message)
    }
  }

  return summary
}
