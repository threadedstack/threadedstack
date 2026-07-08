import type { TContextSource, TRecordQuery } from '@tdsk/domain'

import { EQueryOp } from '@tdsk/domain'
import {
  loadPrompt,
  CmoAgentId,
  OpsProjectId,
  BoardPlansSource,
  BoardStrategySource,
  BoardPositionsSource,
  MarketingArtifactsSource,
  BoardOpenDecisionsSource,
} from '@TDB/seeds/agentSchedules'
import { ResidentConfigsCollectionName } from '@TDB/seeds/resident/collections'

/**
 * Resident config seed records — Resident Agents R4 (CMO pilot activation).
 *
 * One declarative `resident_configs` record per ACTIVATED resident, seeded
 * create-if-absent by `reconcileResidentConfigs` below: the record is the
 * agent's OWN document (it evolves it via updateResidentConfig), so an
 * existing record is NEVER overwritten by a deploy — git seeds the starting
 * state, the agent owns it from there. Every field name and unit matches what
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
    ],
    // The housekeeping map the R2 runtime dispatches through (TResidentFunctions).
    // No writeMemory Function exists on the platform, so the key is omitted —
    // the pump skips tdsk-memories blocks with a log line, never assumes it.
    functions: {
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
    },
  },
}

/** Every resident config seed, in activation order. */
export const ResidentConfigSeedRecords: TResidentConfigSeedRecord[] = [
  CmoResidentConfigSeed,
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
}

export type TResidentConfigsAction = `created` | `unchanged` | `error`

export type TResidentConfigsSummary = {
  created: number
  unchanged: number
  errors: number
  results: {
    agentId: string
    action: TResidentConfigsAction
    message?: string
  }[]
}

/**
 * Idempotently seed the resident config records: a resident with NO
 * `resident_configs` record (keyed by agentId within the target project) gets
 * its seed created; an existing record — even one the agent has since evolved
 * — is left byte-untouched (the record is agent-owned after activation; git
 * only supplies the starting state). Never throws — every outcome is captured
 * in the summary.
 */
export const reconcileResidentConfigs = async (
  service: TResidentConfigRecordService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TResidentConfigsSummary> => {
  const summary: TResidentConfigsSummary = {
    created: 0,
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
        summary.unchanged++
        summary.results.push({ agentId, action: `unchanged` })
        log(`  ➖ resident config ${agentId} — exists (agent-owned, untouched)`)
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
