import type { TCollectionSchema } from '@tdsk/domain'

import { EFieldType } from '@tdsk/domain'
import { Ids } from '@TDB/seeds/ids.seed'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'

/**
 * Board Collections + seed records — Exec-Board on Primitives (⑤a-2).
 *
 * Expresses the AI executive board's state as Collections (①) in the live exec
 * project, mirroring the hard-coded `decision_proposals` / `decision_positions` /
 * `company_strategies` columns 1:1, plus a `board_members` collection that holds
 * membership-as-data (replacing the `getBoardMembers()` constants). Additive and
 * inert: no effect Function reads these yet (that is ⑤a-3), and the board
 * schedules stay `enabled:false` until activation (⑤a-5).
 *
 * `reconcileExecBoard` below is a pure, DB-agnostic upsert (injected services),
 * so it is unit-testable without a live connection — the same pattern as
 * `reconcileSchedules`. The deploy runner in `scripts/reconcileExecBoard.ts`
 * wires it to the real collection + record services. Idempotent: an existing
 * collection (keyed by projectId+name) is left untouched; every seed record is
 * upserted by a stable id, so a re-run creates nothing new.
 */

/**
 * Board membership agent ids. These match the backend board constants
 * (`CeoAgentId` / `BoardCtoAgentId` in `repos/backend/src/constants/board.ts`)
 * and the fullorg + agentSchedules seeds. The database repo cannot import the
 * backend, so the CTO literal is mirrored here exactly as `agentSchedules.ts`
 * mirrors it; the CEO and CMO ids are the seeded founder agents
 * (`Ids.agent.ceo` / `Ids.agent.cmo`).
 */
export const BoardCeoAgentId = Ids.agent.ceo
export const BoardCtoAgentId = `ag_lvUbjp_`
export const BoardCmoAgentId = Ids.agent.cmo

/** A board Collection definition: a stable id, name, description, and field schema. */
export type TExecBoardCollectionDef = {
  id: string
  name: string
  description: string
  schema: TCollectionSchema
}

/**
 * The five board Collections. The first four mirror the columns of the tables
 * they replace 1:1 (data columns only — the `base` id/timestamps and the org
 * scope become the Collection's own id + project scope); `marketing_artifacts`
 * is native to the primitives (the CMO seat has no legacy table). Fields the
 * source column marks NOT NULL are `required`; nullable columns are optional.
 */
export const ExecBoardCollectionDefs: TExecBoardCollectionDef[] = [
  {
    // board_members — membership-as-data; this IS getBoardMembers() as records.
    id: `col_bmemb1`,
    name: `board_members`,
    description: `Executive board membership — one record per member ({ agentId, role, isCEO }). Replaces the getBoardMembers() constants as data.`,
    schema: [
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `role`, type: EFieldType.string, required: true },
      { name: `isCEO`, type: EFieldType.boolean },
    ],
  },
  {
    // decision_proposals — mirrors repos/database/src/schemas/decisionProposals.ts
    id: `col_dprop1`,
    name: `decision_proposals`,
    description: `Board decision proposals — mirrors the decision_proposals table (a member opens a proposal; members post per-round positions; it resolves on consensus or CEO tiebreak).`,
    schema: [
      { name: `title`, type: EFieldType.string, required: true },
      { name: `axis`, type: EFieldType.string, required: true },
      { name: `description`, type: EFieldType.string, required: true },
      { name: `evidence`, type: EFieldType.array, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `round`, type: EFieldType.number, required: true },
      { name: `resolution`, type: EFieldType.string },
      { name: `resolvedRef`, type: EFieldType.string },
      { name: `openedByAgentId`, type: EFieldType.string, required: true },
    ],
  },
  {
    // decision_positions — mirrors repos/database/src/schemas/decisionPositions.ts
    id: `col_dposn1`,
    name: `decision_positions`,
    description: `Per-round board member positions on a proposal — mirrors the decision_positions table (uniqueness by proposalId+agentId+round enforced by the postPosition upsert key).`,
    schema: [
      { name: `proposalId`, type: EFieldType.string, required: true },
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `stance`, type: EFieldType.string, required: true },
      { name: `reasoning`, type: EFieldType.string, required: true },
      { name: `round`, type: EFieldType.number, required: true },
    ],
  },
  {
    // company_strategy — mirrors repos/database/src/schemas/companyStrategies.ts
    id: `col_cstra1`,
    name: `company_strategy`,
    description: `The single company strategy record — mirrors the company_strategies table (North Star + segments + positioning + prioritized backlog + one frozen Active Initiative, or null).`,
    schema: [
      { name: `northStar`, type: EFieldType.string },
      { name: `segments`, type: EFieldType.array },
      { name: `positioning`, type: EFieldType.string },
      { name: `backlog`, type: EFieldType.array },
      { name: `activeInitiative`, type: EFieldType.object },
    ],
  },
  {
    // marketing_artifacts — the CMO's drafting surface (go-to-market reframe).
    // Every record is a DRAFT/PROPOSAL for the board: no external-send
    // capability exists, so a budget is data, never a spend.
    id: `col_mktar1`,
    name: `marketing_artifacts`,
    description: `CMO go-to-market/marketing artifacts — gtm-plans, channel plans, campaign drafts, ad-buy proposals (with budgets), and business-plan sections. Every record is a draft/proposal for the board; no external sends exist.`,
    schema: [
      { name: `kind`, type: EFieldType.string, required: true },
      { name: `title`, type: EFieldType.string, required: true },
      { name: `body`, type: EFieldType.string, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `budget`, type: EFieldType.object },
      { name: `evidence`, type: EFieldType.array },
    ],
  },
]

/** A seed record: which collection it belongs to, a stable id, and the document. */
export type TExecBoardRecordSeed = {
  collection: string
  id: string
  data: Record<string, any>
}

/**
 * Seed records — the three board_members (CEO + CTO + CMO) and the single
 * company_strategy singleton. Seeded fresh with a valid empty-initial strategy
 * ({ northStar:'', segments:[], positioning:'', backlog:[], activeInitiative:null }).
 * Each carries a stable id so the upsert is idempotent (re-run = no new rows).
 * Membership IS the consensus set: resolveBoard derives its member list from
 * these records, so seeding the CMO row makes consensus three-seat everywhere.
 */
export const ExecBoardRecordSeeds: TExecBoardRecordSeed[] = [
  {
    collection: `board_members`,
    id: `rec_bmceo1`,
    data: { agentId: BoardCeoAgentId, role: `ceo`, isCEO: true },
  },
  {
    collection: `board_members`,
    id: `rec_bmcto1`,
    data: { agentId: BoardCtoAgentId, role: `cto`, isCEO: false },
  },
  {
    collection: `board_members`,
    id: `rec_bmcmo1`,
    data: { agentId: BoardCmoAgentId, role: `cmo`, isCEO: false },
  },
  {
    collection: `company_strategy`,
    id: `rec_strat1`,
    data: {
      northStar: ``,
      segments: [],
      positioning: ``,
      backlog: [],
      activeInitiative: null,
    },
  },
]

/** The collection-service slice the reconcile needs (create + name lookup). */
export type TCollectionSeedService = {
  getByName: (projectId: string, name: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
}

/** The record-service slice the reconcile needs (id-keyed upsert). */
export type TRecordSeedService = {
  upsert: (
    projectId: string,
    collectionName: string,
    input: { id?: string; data: Record<string, any> }
  ) => Promise<{ data?: any; error?: any }>
}

export type TExecBoardSeedServices = {
  collection: TCollectionSeedService
  record: TRecordSeedService
}

export type TExecBoardSeedAction = `created` | `unchanged` | `upserted` | `error`

export type TExecBoardSeedSummary = {
  collectionsCreated: number
  collectionsUnchanged: number
  recordsUpserted: number
  errors: number
  results: {
    name: string
    kind: `collection` | `record`
    action: TExecBoardSeedAction
    message?: string
  }[]
}

/**
 * Idempotently seed the five board Collections + membership/strategy records
 * into the exec project. Collections are created only when absent (keyed by
 * projectId+name); records are upserted by stable id (create-or-replace), so a
 * re-run makes no changes. Never throws — every outcome is captured in the
 * summary.
 */
export const reconcileExecBoard = async (
  services: TExecBoardSeedServices,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TExecBoardSeedSummary> => {
  const summary: TExecBoardSeedSummary = {
    collectionsCreated: 0,
    collectionsUnchanged: 0,
    recordsUpserted: 0,
    errors: 0,
    results: [],
  }

  const fail = (name: string, kind: `collection` | `record`, message?: string) => {
    summary.errors++
    summary.results.push({ name, kind, action: `error`, message })
    log(`  ❌ ${kind} ${name} — ${message ?? `unknown error`}`)
  }

  for (const def of ExecBoardCollectionDefs) {
    try {
      const existing = await services.collection.getByName(projectId, def.name)
      if (existing.error) {
        fail(def.name, `collection`, `getByName failed: ${existing.error.message}`)
        continue
      }

      if (existing.data) {
        summary.collectionsUnchanged++
        summary.results.push({ name: def.name, kind: `collection`, action: `unchanged` })
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
      if (res.error) fail(def.name, `collection`, `create failed: ${res.error.message}`)
      else {
        summary.collectionsCreated++
        summary.results.push({ name: def.name, kind: `collection`, action: `created` })
        log(`  ✅ collection ${def.name} — created`)
      }
    } catch (err: any) {
      fail(def.name, `collection`, err?.message)
    }
  }

  for (const seed of ExecBoardRecordSeeds) {
    try {
      const res = await services.record.upsert(projectId, seed.collection, {
        id: seed.id,
        data: seed.data,
      })
      if (res.error)
        fail(
          `${seed.collection}:${seed.id}`,
          `record`,
          `upsert failed: ${res.error.message}`
        )
      else {
        summary.recordsUpserted++
        summary.results.push({
          name: `${seed.collection}:${seed.id}`,
          kind: `record`,
          action: `upserted`,
        })
        log(`  ✅ record ${seed.collection}:${seed.id} — upserted`)
      }
    } catch (err: any) {
      fail(`${seed.collection}:${seed.id}`, `record`, err?.message)
    }
  }

  return summary
}
