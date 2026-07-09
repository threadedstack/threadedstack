import type { TContextSource, TRecordQuery } from '@tdsk/domain'

import { EQueryOp } from '@tdsk/domain'
import {
  loadPrompt,
  CeoAgentId,
  CmoAgentId,
  OpsProjectId,
  BoardPlansSource,
  BoardStrategySource,
  BoardPositionsSource,
  MarketingArtifactsSource,
  BoardOpenDecisionsSource,
} from '@TDB/seeds/agentSchedules'
import { stableStringify } from '@TDB/seeds/reconcileSchedules'
import {
  ResidentConfigsCollectionName,
  ResidentMemoriesCollectionName,
} from '@TDB/seeds/resident/collections'

/**
 * Durable-recall source: the resident's own most-recent memories (newest first),
 * surfaced back into every turn so learning written via writeMemory survives
 * compaction. Scoped to the resident's agentId (the seed is CMO-specific).
 */
export const CmoMemoriesSource: TContextSource = {
  as: `Recent memories`,
  collection: ResidentMemoriesCollectionName,
  query: {
    where: [{ field: `agentId`, op: EQueryOp.eq, value: CmoAgentId }],
    orderBy: { field: `at`, direction: `desc` },
    limit: 20,
  } as TRecordQuery,
}

/** The CEO resident's durable-recall source (its own memories, newest first). */
export const CeoMemoriesSource: TContextSource = {
  as: `Recent memories`,
  collection: ResidentMemoriesCollectionName,
  query: {
    where: [{ field: `agentId`, op: EQueryOp.eq, value: CeoAgentId }],
    orderBy: { field: `at`, direction: `desc` },
    limit: 20,
  } as TRecordQuery,
}

/**
 * Resident config seed records — Resident Agents R4 (CMO pilot activation).
 *
 * One declarative `resident_configs` record per ACTIVATED resident, reconciled
 * by `reconcileResidentConfigs` below: created if absent, and re-applied from
 * this seed on drift WHILE the platform owns it, so a capability/prompt update
 * here reaches a live resident. The moment the agent evolves the record via
 * updateResidentConfig it is stamped `evolvedByAgent` and becomes its OWN
 * document — from there a deploy never overwrites it. Every field name and unit matches what
 * the R2 runtime reads (repos/resident/src/config.ts `normalizeResidentConfig`
 * / types/resident.types.ts `TResidentConfig`); the records.test.ts guard runs
 * this seed through that exact parser so config/runtime drift can never land.
 *
 * The seed stays INERT in prod until the CMO's body sandbox is flipped to
 * resident mode (`sandbox.config.resident`) — the watchdog skips a
 * resident_configs record whose sandbox is not in resident mode.
 */

/** A resident config seed: a stable record id + the config document. */
export type TResidentConfigSeedRecord = {
  /** Stable `records.id` (rec_ prefix, 10-char id shape). */
  id: string
  data: {
    agentId: string
    agenda: { key: string; cron: string; prompt: string }[]
    watches: {
      key: string
      collection: string
      query: TRecordQuery
      prompt: string
      debounceMs?: number
      pollMs?: number
    }[]
    inbox: { pollMs: number }
    compaction: { maxTurns: number; maxBytes: number }
    session: { seedPrompt: string; contextSources: TContextSource[] }
    subAgents: { maxConcurrent: number }
    selfDirected: { prompt: string; minIdleMs: number }
    actions: string[]
    functions: Record<string, string>
  }
}

/**
 * The CMO resident config (the R4 pilot). Prompt reuse: the agenda item and
 * the deliberation watch load the SAME `agent-schedules/{cmo-marketing,
 * cmo-board}.md` files the (now disabled) scheduled defs load, via the same
 * `loadPrompt`; the session seed is `agent-schedules/cmo-resident-session.md`
 * (the soul paragraph + standing directives, drawn from those two files).
 * Context reuse: the session's contextSources are the exact five source
 * objects the two scheduled defs carried (Strategy, MarketingArtifacts,
 * OpenDecisions, Positions, Plans), and the two watch queries reference the
 * matching sources' queries so the watched sets and the injected context can
 * never drift apart.
 */
export const CmoResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_cmores`,
  data: {
    agentId: CmoAgentId,
    // The daily marketing cycle, unchanged cadence — the resident agenda
    // replaces the disabled sd_cmomkt1 cron def.
    agenda: [
      {
        key: `marketing`,
        cron: `0 5 * * *`,
        prompt: loadPrompt(`cmo-marketing`),
      },
    ],
    watches: [
      // Replaces the disabled sd_cmobrd1 deliberation cron: a new/deliberating
      // decision fires this watch, so positions post within minutes instead of
      // at the next :45. 60s debounce = the runtime's DefaultWatchDebounceMs —
      // one turn per change burst, never a hot loop.
      {
        key: `deliberation`,
        collection: BoardOpenDecisionsSource.collection,
        query: BoardOpenDecisionsSource.query,
        debounceMs: 60_000,
        prompt: loadPrompt(`cmo-board`),
      },
      // Plans move slower than decisions — a 10-minute debounce keeps this to
      // lane-review cadence rather than reacting to every milestone patch.
      {
        key: `plans`,
        collection: BoardPlansSource.collection,
        query: BoardPlansSource.query,
        debounceMs: 600_000,
        prompt: [
          `The active plans changed — review whether your GTM lane needs action.`,
          `Check the gtm plan's open milestones and keyResults against the change shown in the matched records: if your lane is affected, act (advance a milestone, draft or update an artifact, or prepare a board decision); if it is not, say so in one line and stop.`,
        ].join(`\n`),
      },
    ],
    inbox: { pollMs: 15_000 },
    // Explicit copies of the R2 defaults (constants.ts DefaultMaxTurns /
    // DefaultMaxBytes) so the thresholds are visible config, not implicit.
    compaction: { maxTurns: 40, maxBytes: 400_000 },
    session: {
      seedPrompt: loadPrompt(`cmo-resident-session`),
      contextSources: [
        BoardStrategySource,
        MarketingArtifactsSource,
        BoardOpenDecisionsSource,
        BoardPositionsSource,
        BoardPlansSource,
        CmoMemoriesSource,
      ],
    },
    subAgents: { maxConcurrent: 2 },
    selfDirected: {
      minIdleMs: 600_000,
      prompt: `Advance your GTM lane: pick the highest-value next action from your active plans' open milestones; research, draft artifacts, or prepare decisions.`,
    },
    // The server-side dispatch allowlist (resolveResidentAllowlist reads this
    // array): the union of the two scheduled defs' allowlists plus the five R3
    // housekeeping Functions.
    actions: [
      `postPosition`,
      `openDecision`,
      `saveMarketingArtifact`,
      `upsertPlan`,
      `updateMilestone`,
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ],
    // The housekeeping map the R2 runtime dispatches through (TResidentFunctions).
    // `writeMemory` persists a turn's tdsk-memories block into resident_memories;
    // CmoMemoriesSource above surfaces them back, so learning survives compaction.
    functions: {
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
      writeMemory: `writeMemory`,
    },
  },
}

/**
 * The CEO resident config (Resident Agents R5). Prompt reuse: the strategy
 * agenda loads `agent-schedules/ceo-strategy.md` and the board-review agenda
 * loads `agent-schedules/ceo-board.md` (the SAME files the disabled sd_ceostr1/
 * sd_ceobrd1 crons load), via the same `loadPrompt`; the session seed is
 * `agent-schedules/ceo-resident-session.md`.
 *
 * Board resolution is a PERIODIC agenda (every 3h), NOT a fast watch: the CEO
 * RESOLVES decisions (unlike the CMO, which only POSTS positions on its fast
 * deliberation watch), and resolution must be paced to the board's deliberation
 * window. A 60s decision watch would spin uselessly against the CTO's slower
 * position cadence and would collapse the deliberate openDecision (strategy
 * cycle) vs resolveBoard (board cycle) separation. The only watch is `plans`.
 */
export const CeoResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_ceores`,
  data: {
    agentId: CeoAgentId,
    agenda: [
      // The daily strategy cycle, unchanged cadence — replaces sd_ceostr1.
      {
        key: `strategy`,
        cron: `0 4 * * *`,
        prompt: loadPrompt(`ceo-strategy`),
      },
      // Board review every 3h (NOT a fast watch): post the CEO's position and
      // resolve RIPE decisions. Paced so resolveBoard sees accrued positions
      // rather than spinning; replaces the 6-hourly sd_ceobrd1 cron.
      {
        key: `board-review`,
        cron: `0 */3 * * *`,
        prompt: loadPrompt(`ceo-board`),
      },
    ],
    watches: [
      // Plans move slower than decisions — a 10-minute debounce keeps this to
      // lane-review cadence. The CEO owns the company + initiative plans. There
      // is deliberately NO decision watch: the CEO resolves, and resolution is
      // agenda-paced (see the doc above), never watch-fast.
      {
        key: `plans`,
        collection: BoardPlansSource.collection,
        query: BoardPlansSource.query,
        debounceMs: 600_000,
        prompt: [
          `The active plans changed — review whether the company or initiative plans need action.`,
          `Check your company and initiative plans' open milestones and keyResults against the change shown in the matched records: if a plan you own is affected, act (advance a milestone, update strategy, or prepare a board decision); if not, say so in one line and stop.`,
        ].join(`\n`),
      },
    ],
    inbox: { pollMs: 15_000 },
    compaction: { maxTurns: 40, maxBytes: 400_000 },
    session: {
      seedPrompt: loadPrompt(`ceo-resident-session`),
      contextSources: [
        BoardStrategySource,
        BoardOpenDecisionsSource,
        BoardPositionsSource,
        BoardPlansSource,
        CeoMemoriesSource,
      ],
    },
    subAgents: { maxConcurrent: 2 },
    selfDirected: {
      minIdleMs: 600_000,
      prompt: `Advance company strategy: refine positioning and segments from research, maintain the company and initiative plans' open milestones, and prepare decisions for the board. NEVER resolve a decision you opened this turn.`,
    },
    // The dispatch allowlist: the union of the strategy cycle (upsertStrategy,
    // openDecision, upsertPlan, updateMilestone) and the board cycle
    // (postPosition, resolveBoard) allowlists, plus the housekeeping Functions.
    // openDecision and resolveBoard stay prompt-separated (strategy agenda opens,
    // board-review agenda resolves) per the ceo-resident-session guard.
    actions: [
      `upsertStrategy`,
      `openDecision`,
      `upsertPlan`,
      `updateMilestone`,
      `postPosition`,
      `resolveBoard`,
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ],
    functions: {
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
      writeMemory: `writeMemory`,
    },
  },
}

/** Every resident config seed, in activation order. */
export const ResidentConfigSeedRecords: TResidentConfigSeedRecord[] = [
  CmoResidentConfigSeed,
  CeoResidentConfigSeed,
]

/** The record-service slice the reconcile needs (project+collection-scoped). */
export type TResidentConfigRecordService = {
  query: (
    projectId: string,
    collectionName: string,
    query: TRecordQuery
  ) => Promise<{ data?: any[]; error?: any }>
  upsert: (
    projectId: string,
    collectionName: string,
    input: { id?: string; data: Record<string, unknown> }
  ) => Promise<{ data?: any; error?: any }>
  replaceIfMarkerUnset: (
    projectId: string,
    collectionName: string,
    id: string,
    markerKey: string,
    data: Record<string, unknown>
  ) => Promise<{ data?: any; error?: any; skipped?: boolean }>
}

export type TResidentConfigsAction = `created` | `updated` | `unchanged` | `error`

export type TResidentConfigsSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: {
    agentId: string
    action: TResidentConfigsAction
    message?: string
  }[]
}

/**
 * Reconcile the resident config records so platform capability/prompt updates
 * propagate to live residents. A resident with NO `resident_configs` record is
 * created from its seed. An EXISTING record is UPDATED from the seed UNLESS the
 * agent has taken ownership (`data.evolvedByAgent === true`, stamped by
 * updateResidentConfig) — an agent-evolved config is left byte-untouched. So an
 * added capability (an added Function, an updated prompt) reaches a resident
 * that has not customized its own config, while an agent that has evolved its
 * config keeps it. Never throws — every outcome is captured in the summary.
 */
export const reconcileResidentConfigs = async (
  service: TResidentConfigRecordService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TResidentConfigsSummary> => {
  const summary: TResidentConfigsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (agentId: string, message?: string) => {
    summary.errors++
    summary.results.push({ agentId, action: `error`, message })
    log(`  ❌ resident config ${agentId} — ${message ?? `unknown error`}`)
  }

  for (const seed of ResidentConfigSeedRecords) {
    const { agentId } = seed.data
    try {
      const existing = await service.query(projectId, ResidentConfigsCollectionName, {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }],
        limit: 1,
      })
      if (existing.error) {
        fail(agentId, `query failed: ${existing.error.message}`)
        continue
      }

      if (existing.data?.length) {
        const row = existing.data[0]
        // Agent has taken ownership → never touch it.
        if (row.data?.evolvedByAgent === true) {
          summary.unchanged++
          summary.results.push({ agentId, action: `unchanged` })
          log(`  ➖ resident config ${agentId} — agent-evolved, untouched`)
          continue
        }
        // Platform still owns it → re-apply the seed ONLY when it drifts, so a
        // re-run of an up-to-date config is a true no-op (stable, order-
        // independent compare — a jsonb round trip reorders keys).
        if (stableStringify(row.data) === stableStringify(seed.data)) {
          summary.unchanged++
          summary.results.push({ agentId, action: `unchanged` })
          log(`  ➖ resident config ${agentId} — up to date`)
          continue
        }
        // Drift → propagate the capability/prompt update. The write is an ATOMIC
        // guarded replace (only lands while the row is still platform-owned), so
        // an updateResidentConfig call that stamps `evolvedByAgent` between the
        // read above and this write is never clobbered — the guard skips instead.
        const upd = await service.replaceIfMarkerUnset(
          projectId,
          ResidentConfigsCollectionName,
          row.id,
          `evolvedByAgent`,
          seed.data
        )
        if (upd.error) fail(agentId, `update failed: ${upd.error.message}`)
        else if (upd.skipped) {
          summary.unchanged++
          summary.results.push({ agentId, action: `unchanged` })
          log(
            `  ➖ resident config ${agentId} — agent claimed ownership mid-reconcile, untouched`
          )
        } else {
          summary.updated++
          summary.results.push({ agentId, action: `updated` })
          log(
            `  🔄 resident config ${agentId} — updated from seed (not yet agent-evolved)`
          )
        }
        continue
      }

      const res = await service.upsert(projectId, ResidentConfigsCollectionName, {
        id: seed.id,
        data: seed.data,
      })
      if (res.error) fail(agentId, `create failed: ${res.error.message}`)
      else {
        summary.created++
        summary.results.push({ agentId, action: `created` })
        log(`  ✅ resident config ${agentId} — created`)
      }
    } catch (err: any) {
      fail(agentId, err?.message)
    }
  }

  return summary
}
