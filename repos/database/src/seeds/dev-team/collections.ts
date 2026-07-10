import type { TCollectionSchema } from '@tdsk/domain'

import { EFieldType } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'

/**
 * Realtime dev-team Collections — the shared work state for the resident
 * engineering team (N engineer residents + a CTO lead).
 *
 * `dev_tasks` is the team's single source of truth: a task moves through an
 * explicit state machine and every transition is won via the atomic
 * `records.cas` primitive, so two engineers can never claim the same task or
 * the same review. Watches on this collection are what make the team
 * REALTIME: a task flipping to `pr_open` wakes a reviewer within seconds; a
 * `changes_requested` flip wakes the author.
 *
 * State machine (all transitions via cas, guarded on the current state):
 *   backlog → claimed            (engineer wins the work claim + lease)
 *   claimed → pr_open            (author opened the PR; prNumber/headSha set)
 *   pr_open → in_review          (a DIFFERENT engineer wins the review claim)
 *   in_review → approved         (review passed on the recorded headSha)
 *   in_review → changes_requested(review found problems; wakes the author)
 *   changes_requested → pr_open  (author pushed a fix; headSha updated →
 *                                 prior review is void, re-review required)
 *   approved → merged            (reviewer merges on green CI)
 *   any → abandoned | failed     (explicitly closed out, with notes)
 *
 * Leases: `assignee`/`reviewer` claims carry `leaseExpiresAt` (epoch ms) that
 * the holder renews while working. The reaper (a CTO duty, not platform code)
 * queries expired leases and CAS-reclaims them — guarded on the exact
 * leaseExpiresAt it read, so a concurrent renewal always wins — after
 * reconciling against real GitHub state (never duplicating an in-flight PR).
 *
 * Additive and inert: nothing consumes this collection until the Phase 2
 * shadow team is stood up.
 */

/** Collection name — mirrored by the dev-team resident configs (seeds/resident/records.ts) and the team Functions. */
export const DevTasksCollectionName = `dev_tasks`

/** A dev-team Collection definition: a stable id, name, description, and field schema. */
export type TDevTeamCollectionDef = {
  id: string
  name: string
  description: string
  schema: TCollectionSchema
}

export const DevTeamCollectionDefs: TDevTeamCollectionDef[] = [
  {
    id: `col_dvtsk1`,
    name: DevTasksCollectionName,
    description: `Realtime dev-team work items — the concurrent task/review state machine (backlog → claimed → pr_open → in_review → approved/changes_requested → merged). Every transition is claimed atomically via records.cas; claims carry renewable leases; reviews bind to headSha.`,
    schema: [
      { name: `title`, type: EFieldType.string, required: true },
      { name: `description`, type: EFieldType.string, required: true },
      { name: `state`, type: EFieldType.string, required: true },
      { name: `priority`, type: EFieldType.string },
      // The engineer holding the WORK claim (authorship)
      { name: `assignee`, type: EFieldType.string },
      // The engineer holding the REVIEW claim — must never equal assignee
      { name: `reviewer`, type: EFieldType.string },
      // Claim liveness (epoch ms): renewed while working, reaped when expired
      { name: `leaseExpiresAt`, type: EFieldType.number },
      { name: `claimedAt`, type: EFieldType.number },
      // GitHub linkage — the reaper reconciles against these before reclaiming
      { name: `prNumber`, type: EFieldType.number },
      { name: `prUrl`, type: EFieldType.string },
      { name: `branch`, type: EFieldType.string },
      // The exact commit the review evaluated; a new push voids the review
      { name: `headSha`, type: EFieldType.string },
      { name: `evidence`, type: EFieldType.string },
      // Provenance from the sensor backlog when promoted from a proposal
      { name: `sourceTaskProposalId`, type: EFieldType.string },
      // Freeform handoff notes (review feedback, blockers, context)
      { name: `notes`, type: EFieldType.string },
      // Append-only transition log entries ({at, from, to, by})
      { name: `history`, type: EFieldType.array },
      { name: `createdBy`, type: EFieldType.string, required: true },
    ],
  },
]

/** The collection-service slice the reconcile needs (create + name lookup). */
export type TDevTeamCollectionService = {
  getByName: (projectId: string, name: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TDevTeamSeedServices = {
  collection: TDevTeamCollectionService
}

export type TDevTeamSeedAction = `created` | `unchanged` | `error`

export type TDevTeamSeedSummary = {
  collectionsCreated: number
  collectionsUnchanged: number
  errors: number
  results: {
    name: string
    action: TDevTeamSeedAction
    message?: string
  }[]
}

/**
 * Idempotently seed the dev-team Collections into the ops project. Collections
 * are created only when absent (keyed by projectId+name), so a re-run makes no
 * changes. There are NO seed records — the backlog is fed live (promoted task
 * proposals / CTO grooming). Never throws — every outcome is captured in the
 * summary.
 */
export const reconcileDevTeam = async (
  services: TDevTeamSeedServices,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TDevTeamSeedSummary> => {
  const summary: TDevTeamSeedSummary = {
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

  for (const def of DevTeamCollectionDefs) {
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
