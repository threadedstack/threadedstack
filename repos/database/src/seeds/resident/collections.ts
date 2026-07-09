import type { TCollectionSchema } from '@tdsk/domain'

import { EFieldType } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'

/**
 * Resident data-plane Collections — Resident Agents R3 (spec §2).
 *
 * Expresses the resident runtime's state as Collections (①): `resident_configs`
 * (one record per resident — agenda/watches/inbox/compaction/session/subAgents/
 * selfDirected, plus the `actions` dispatch allowlist and the `functions`
 * housekeeping map the R2 runtime reads), `agent_messages` (the inbox),
 * `resident_status` (heartbeat/liveness the watchdog reads), and
 * `resident_transcripts` (per-turn observability — the appendTranscript
 * Function is records-only, so turns land here rather than on a thread).
 *
 * This module owns the COLLECTIONS only; the activated residents'
 * resident_configs seed records live in `seeds/resident/records.ts` (R4).
 * `reconcileResident` below is a pure, DB-agnostic upsert (injected service),
 * the same pattern as `reconcileDevLoop`, so it is unit-testable without a
 * live connection. The deploy runner in `scripts/reconcileResident.ts` wires
 * it to the real collection service. Idempotent: an existing collection
 * (keyed by projectId+name) is left untouched, so a re-run creates nothing
 * new.
 */

/** A resident Collection definition: a stable id, name, description, and field schema. */
export type TResidentCollectionDef = {
  id: string
  name: string
  description: string
  schema: TCollectionSchema
}

/** Collection names — mirrored by repos/resident/src/constants.ts and the backend watchdog/allowlist resolver. */
export const ResidentConfigsCollectionName = `resident_configs`
export const AgentMessagesCollectionName = `agent_messages`
export const ResidentStatusCollectionName = `resident_status`
export const ResidentTranscriptsCollectionName = `resident_transcripts`
export const ResidentMemoriesCollectionName = `resident_memories`

/**
 * The four resident Collections. `resident_configs` carries the spec §2 record
 * shape; only `agentId` is required so a partial config (e.g. agenda-only) is
 * a valid record — the R2 runtime's `normalizeResidentConfig` defaults every
 * missing section.
 */
export const ResidentCollectionDefs: TResidentCollectionDef[] = [
  {
    id: `col_rescfg`,
    name: ResidentConfigsCollectionName,
    description: `Resident agent configs — one record per resident ({ agentId, agenda[], watches[], inbox{}, compaction{}, session{}, subAgents{}, selfDirected{}, functions{}, actions[] }). The agent evolves its OWN record via updateResidentConfig; \`actions\` is the server-side dispatch allowlist read by resolveResidentAllowlist.`,
    schema: [
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `agenda`, type: EFieldType.array },
      { name: `watches`, type: EFieldType.array },
      { name: `inbox`, type: EFieldType.object },
      { name: `compaction`, type: EFieldType.object },
      { name: `session`, type: EFieldType.object },
      { name: `subAgents`, type: EFieldType.object },
      { name: `selfDirected`, type: EFieldType.object },
      { name: `functions`, type: EFieldType.object },
      { name: `actions`, type: EFieldType.array },
    ],
  },
  {
    id: `col_agmsgs`,
    name: AgentMessagesCollectionName,
    description: `The agent inbox — { to, from, subject, body, refs[], readAt }. Sending = the sendAgentMessage Function (caller-stamped from); delivery = each resident's inbox watch; read receipts = the markMessageRead Function patching readAt.`,
    schema: [
      { name: `to`, type: EFieldType.string, required: true },
      { name: `from`, type: EFieldType.string, required: true },
      { name: `subject`, type: EFieldType.string },
      { name: `body`, type: EFieldType.string, required: true },
      { name: `refs`, type: EFieldType.array },
      { name: `readAt`, type: EFieldType.string },
    ],
  },
  {
    id: `col_resstt`,
    name: ResidentStatusCollectionName,
    description: `Resident liveness — one record per resident ({ agentId, sessionId, queueDepth, currentActivity, lastTurnAt, turnCount, degraded }), upserted by the heartbeat Function every beat. The watchdog reads the record's write time for heartbeat freshness and sets degraded on crash-loop.`,
    schema: [
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `sessionId`, type: EFieldType.string },
      { name: `queueDepth`, type: EFieldType.number },
      { name: `currentActivity`, type: EFieldType.string },
      { name: `lastTurnAt`, type: EFieldType.string },
      { name: `turnCount`, type: EFieldType.number },
      { name: `degraded`, type: EFieldType.boolean },
    ],
  },
  {
    id: `col_restrn`,
    name: ResidentTranscriptsCollectionName,
    description: `Per-turn resident transcripts — { agentId, event, input, output, at }, appended (one record per turn) by the appendTranscript Function. The records-only stand-in for the continuity-thread write: Functions hold the records capability, not threads.`,
    schema: [
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `event`, type: EFieldType.string, required: true },
      { name: `input`, type: EFieldType.string },
      { name: `output`, type: EFieldType.string },
      { name: `at`, type: EFieldType.string, required: true },
    ],
  },
  {
    id: `col_resmem`,
    name: ResidentMemoriesCollectionName,
    description: `Durable resident memories — { agentId, text, importance (1-10), kind?, meta?, at }, appended (one record per memory) by the writeMemory Function from a turn's tdsk-memories block. The records-only durable-recall store: the session's contextSources surface the most recent/important entries back into future turns so learning survives compaction.`,
    schema: [
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `text`, type: EFieldType.string, required: true },
      { name: `importance`, type: EFieldType.number },
      { name: `kind`, type: EFieldType.string },
      { name: `meta`, type: EFieldType.object },
      { name: `at`, type: EFieldType.string, required: true },
    ],
  },
]

/** The collection-service slice the reconcile needs (create + name lookup). */
export type TResidentCollectionService = {
  getByName: (projectId: string, name: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TResidentSeedServices = {
  collection: TResidentCollectionService
}

export type TResidentSeedAction = `created` | `unchanged` | `error`

export type TResidentSeedSummary = {
  collectionsCreated: number
  collectionsUnchanged: number
  errors: number
  results: {
    name: string
    action: TResidentSeedAction
    message?: string
  }[]
}

/**
 * Idempotently seed the four resident Collections into the target project.
 * Collections are created only when absent (keyed by projectId+name), so a
 * re-run makes no changes. Seeds NO records itself — activated residents'
 * resident_configs records reconcile via `reconcileResidentConfigs`
 * (seeds/resident/records.ts). Never throws — every outcome is captured in
 * the summary.
 */
export const reconcileResident = async (
  services: TResidentSeedServices,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TResidentSeedSummary> => {
  const summary: TResidentSeedSummary = {
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

  for (const def of ResidentCollectionDefs) {
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
