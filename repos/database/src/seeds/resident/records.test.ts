import { describe, it, expect } from 'vitest'

import { normalizeResidentConfig } from '@tdsk/resident/config'
import {
  loadPrompt,
  CmoAgentId,
  AgentScheduleDefs,
  BoardPlansSource,
  BoardStrategySource,
  BoardPositionsSource,
  MarketingArtifactsSource,
  BoardOpenDecisionsSource,
} from '@TDB/seeds/agentSchedules'
import { ResidentConfigsCollectionName } from '@TDB/seeds/resident/collections'
import {
  CmoMemoriesSource,
  CmoResidentConfigSeed,
  ResidentConfigSeedRecords,
  reconcileResidentConfigs,
} from '@TDB/seeds/resident/records'

const cmoBoardDef = AgentScheduleDefs.find((def) => def.key === `cmo-board`)!
const cmoMarketingDef = AgentScheduleDefs.find((def) => def.key === `cmo-marketing`)!

/**
 * An in-memory fake of the record service's query/upsert slice — enough to
 * prove the reconcile creates a missing resident_configs record, leaves an
 * existing (agent-owned) one byte-untouched, and captures failures, without a
 * live DB. Rows are keyed by projectId+collection+agentId, mirroring the
 * reconcile's one-record-per-agent lookup.
 */
const makeFakeRecordService = () => {
  const rows = new Map<string, any>()
  const key = (projectId: string, collection: string, agentId: string) =>
    `${projectId}:${collection}:${agentId}`
  return {
    rows,
    key,
    service: {
      query: async (projectId: string, collection: string, query: any) => {
        const agentId = query?.where?.[0]?.value
        const row = rows.get(key(projectId, collection, agentId))
        return { data: row ? [{ ...row }] : [] }
      },
      upsert: async (
        projectId: string,
        collection: string,
        input: { id?: string; data: Record<string, unknown> }
      ) => {
        const row = { id: input.id, projectId, collection, data: input.data }
        rows.set(key(projectId, collection, input.data.agentId as string), row)
        return { data: { ...row } }
      },
      // Mirrors the real atomic guard: overwrite ONLY if the stored row does not
      // already carry markerKey === true, else report skipped (no clobber).
      replaceIfMarkerUnset: async (
        projectId: string,
        collection: string,
        id: string,
        markerKey: string,
        data: Record<string, unknown>
      ) => {
        const agentId = data.agentId as string
        const existing = rows.get(key(projectId, collection, agentId))
        if (existing?.data?.[markerKey] === true) return { skipped: true }
        const row = { id, projectId, collection, data }
        rows.set(key(projectId, collection, agentId), row)
        return { data: { ...row } }
      },
    },
  }
}

describe(`CmoResidentConfigSeed`, () => {
  it(`carries the full R4 pilot config for the CMO agent`, () => {
    expect(ResidentConfigSeedRecords).toEqual([CmoResidentConfigSeed])
    // Stable record id (rec_ prefix + 6 chars = the 10-char records.id shape).
    expect(CmoResidentConfigSeed.id).toMatch(/^rec_[A-Za-z0-9_-]{6}$/)

    const { data } = CmoResidentConfigSeed
    expect(data.agentId).toBe(CmoAgentId)

    // Agenda: the daily marketing cycle at the disabled cron def's cadence.
    expect(data.agenda).toHaveLength(1)
    expect(data.agenda[0]).toMatchObject({ key: `marketing`, cron: `0 5 * * *` })

    // Watches: deliberation (fast) + plans (slow lane review).
    expect(data.watches.map((watch) => watch.key)).toEqual([`deliberation`, `plans`])
    const [deliberation, plans] = data.watches
    expect(deliberation).toMatchObject({
      collection: `decision_proposals`,
      debounceMs: 60_000,
    })
    expect(deliberation.query).toEqual({
      where: [{ field: `status`, op: `in`, value: [`open`, `deliberating`] }],
    })
    expect(plans).toMatchObject({ collection: `plans`, debounceMs: 600_000 })
    expect(plans.query).toEqual({
      where: [{ field: `status`, op: `eq`, value: `active` }],
      limit: 10,
    })
    expect(plans.prompt).toContain(`GTM lane`)

    expect(data.inbox).toEqual({ pollMs: 15_000 })
    // Explicit copies of the R2 defaults (DefaultMaxTurns / DefaultMaxBytes).
    expect(data.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
    expect(data.subAgents).toEqual({ maxConcurrent: 2 })
    expect(data.selfDirected.minIdleMs).toBe(600_000)
    expect(data.selfDirected.prompt).toContain(`Advance your GTM lane`)
    expect(data.selfDirected.prompt).toContain(`open milestones`)

    // The housekeeping map the R2 runtime dispatches through — writeMemory
    // persists a turn's tdsk-memories block into resident_memories.
    expect(data.functions).toEqual({
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
      writeMemory: `writeMemory`,
    })
  })

  it(`reuses the scheduled defs' prompts, queries, and context sources verbatim`, () => {
    const { data } = CmoResidentConfigSeed

    // The agenda + deliberation watch load the SAME prompt files the (now
    // disabled) cron defs load — one source of truth per prompt.
    expect(data.agenda[0].prompt).toBe(cmoMarketingDef.prompt)
    expect(data.watches[0].prompt).toBe(cmoBoardDef.prompt)
    expect(data.session.seedPrompt).toBe(loadPrompt(`cmo-resident-session`))
    // The session seed carries the soul + the standing directives.
    expect(data.session.seedPrompt).toContain(`founding CMO of ThreadedStack`)
    expect(data.session.seedPrompt).toContain(`RESIDENT agent`)
    expect(data.session.seedPrompt).toContain(`PRE-LAUNCH`)
    expect(data.session.seedPrompt).toContain(`RESEARCH MANDATE`)
    expect(data.session.seedPrompt).toContain(`primitives faculty`)

    // The five board context sources the two scheduled defs used, plus the
    // resident's own durable-memory recall source — exact shapes.
    expect(data.session.contextSources).toEqual([
      BoardStrategySource,
      MarketingArtifactsSource,
      BoardOpenDecisionsSource,
      BoardPositionsSource,
      BoardPlansSource,
      CmoMemoriesSource,
    ])

    // The watch queries reference the matching sources' queries, so the
    // watched sets and the injected context can never drift apart.
    expect(data.watches[0].query).toBe(BoardOpenDecisionsSource.query)
    expect(data.watches[1].query).toBe(BoardPlansSource.query)
  })

  it(`allowlists the union of both disabled defs' actions plus the 6 housekeeping Functions`, () => {
    const housekeeping = [
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ]
    const union = new Set([
      ...(cmoBoardDef.actions?.functions ?? []),
      ...(cmoMarketingDef.actions?.functions ?? []),
      ...housekeeping,
    ])
    expect(new Set(CmoResidentConfigSeed.data.actions)).toEqual(union)
    expect(CmoResidentConfigSeed.data.actions).toHaveLength(union.size)
    // Never the CEO's resolution power.
    expect(CmoResidentConfigSeed.data.actions).not.toContain(`resolveBoard`)
  })

  it(`satisfies the R2 runtime's config parser exactly, through a jsonb round trip`, () => {
    // Simulate the record's DB write/read round trip, then run it through the
    // ACTUAL parser the resident runtime boots with — the drift guard: a field
    // rename, a bad cron, or a malformed watch in this seed fails HERE, not in
    // a prod pod.
    const roundTripped = JSON.parse(JSON.stringify(CmoResidentConfigSeed.data))
    const normalized = normalizeResidentConfig(roundTripped, CmoAgentId)

    // Nothing dropped: every agenda item and watch survives validation.
    expect(normalized.agenda).toEqual(
      JSON.parse(JSON.stringify(CmoResidentConfigSeed.data.agenda))
    )
    expect(normalized.watches).toEqual(
      JSON.parse(JSON.stringify(CmoResidentConfigSeed.data.watches))
    )

    // Every explicit value lands verbatim; only the inbox collection default
    // is filled in (the seed deliberately omits it — agent_messages).
    expect(normalized.agentId).toBe(CmoAgentId)
    expect(normalized.inbox).toEqual({ pollMs: 15_000, collection: `agent_messages` })
    expect(normalized.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
    expect(normalized.session.seedPrompt).toBe(
      CmoResidentConfigSeed.data.session.seedPrompt
    )
    expect(normalized.session.contextSources).toHaveLength(6)
    expect(normalized.subAgents).toEqual({ maxConcurrent: 2 })
    expect(normalized.selfDirected).toEqual(CmoResidentConfigSeed.data.selfDirected)
    expect(normalized.functions).toEqual(CmoResidentConfigSeed.data.functions)
  })

  it(`the parser guard is load-bearing: an invalid agenda/watch WOULD be dropped`, () => {
    // Negative control proving the round-trip test above actually detects
    // drift: the same parser drops a bad cron and a watch missing its
    // collection, so a regression in the seed cannot pass silently.
    const broken = normalizeResidentConfig(
      {
        agenda: [{ key: `marketing`, cron: `not-a-cron`, prompt: `p` }],
        watches: [{ key: `deliberation`, prompt: `p` } as any],
      },
      CmoAgentId
    )
    expect(broken.agenda).toHaveLength(0)
    expect(broken.watches).toHaveLength(0)
  })
})

describe(`reconcileResidentConfigs`, () => {
  it(`creates the CMO record when absent`, async () => {
    const { service, rows, key } = makeFakeRecordService()

    const summary = await reconcileResidentConfigs(service, `pj_ops00001`)

    expect(summary).toMatchObject({ created: 1, unchanged: 0, errors: 0 })
    expect(summary.results).toEqual([{ agentId: CmoAgentId, action: `created` }])
    const stored = rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId))
    expect(stored).toMatchObject({ id: CmoResidentConfigSeed.id })
    expect(stored.data).toEqual(CmoResidentConfigSeed.data)
  })

  it(`round-trips idempotently — a re-run reports unchanged and writes nothing`, async () => {
    const { service, rows, key } = makeFakeRecordService()

    await reconcileResidentConfigs(service, `pj_ops00001`)
    const snapshot = JSON.parse(JSON.stringify([...rows]))

    const second = await reconcileResidentConfigs(service, `pj_ops00001`)

    expect(second).toMatchObject({ created: 0, unchanged: 1, errors: 0 })
    expect(JSON.parse(JSON.stringify([...rows]))).toEqual(snapshot)
    expect(
      rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId)).data
    ).toEqual(CmoResidentConfigSeed.data)
  })

  it(`NEVER overwrites an agent-evolved record (evolvedByAgent marker) — the agent owns it`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // The agent evolved its own record via updateResidentConfig after
    // activation — that write stamps evolvedByAgent, which claims ownership.
    const evolved = {
      ...CmoResidentConfigSeed.data,
      inbox: { pollMs: 5_000 },
      selfDirected: { prompt: `my own cadence`, minIdleMs: 120_000 },
      evolvedByAgent: true,
    }
    await service.upsert(`pj_ops00001`, ResidentConfigsCollectionName, {
      id: CmoResidentConfigSeed.id,
      data: evolved,
    })

    const summary = await reconcileResidentConfigs(service, `pj_ops00001`)

    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 1, errors: 0 })
    expect(
      rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId)).data
    ).toEqual(evolved)
  })

  it(`propagates a seed update to a NOT-yet-evolved config (platform still owns it)`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // A live config created from an OLD seed (a capability the current seed adds
    // is absent) and never touched by the agent — no evolvedByAgent marker.
    const stale = {
      ...CmoResidentConfigSeed.data,
      actions: CmoResidentConfigSeed.data.actions.filter((a) => a !== `writeMemory`),
    }
    await service.upsert(`pj_ops00001`, ResidentConfigsCollectionName, {
      id: CmoResidentConfigSeed.id,
      data: stale,
    })

    const summary = await reconcileResidentConfigs(service, `pj_ops00001`)

    // Drift → re-applied from the current seed so the capability propagates.
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 0, errors: 0 })
    expect(summary.results).toEqual([{ agentId: CmoAgentId, action: `updated` }])
    const stored = rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId))
    expect(stored.data).toEqual(CmoResidentConfigSeed.data)
    expect(stored.data.actions).toContain(`writeMemory`)
    // Record id preserved through the in-place update.
    expect(stored.id).toBe(CmoResidentConfigSeed.id)
  })

  it(`atomic guard: does NOT clobber a config the agent evolves DURING the reconcile`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // A stale, platform-owned config: drifted from the seed, no ownership marker
    // — so the reconcile's read sees "not evolved + drift" and takes the update
    // path.
    const stale = {
      ...CmoResidentConfigSeed.data,
      actions: CmoResidentConfigSeed.data.actions.filter((a) => a !== `writeMemory`),
    }
    await service.upsert(`pj_ops00001`, ResidentConfigsCollectionName, {
      id: CmoResidentConfigSeed.id,
      data: stale,
    })

    // Simulate the TOCTOU race: the agent calls updateResidentConfig (stamping
    // evolvedByAgent + its own edit) in the window AFTER the reconcile reads the
    // row but BEFORE it writes. We hook query to flip the stored row right after
    // it returns the pre-race snapshot.
    const evolved = {
      ...stale,
      selfDirected: { prompt: `my own cadence`, minIdleMs: 120_000 },
      evolvedByAgent: true,
    }
    const raced = {
      ...service,
      query: async (projectId: string, collection: string, q: any) => {
        const res = await service.query(projectId, collection, q)
        const k = key(projectId, collection, CmoAgentId)
        const cur = rows.get(k)
        if (cur && cur.data?.evolvedByAgent !== true)
          rows.set(k, { ...cur, data: evolved })
        return res // the pre-race snapshot (no marker) — drives the update path
      },
    }

    const summary = await reconcileResidentConfigs(raced as any, `pj_ops00001`)

    // The guard blocked the write: reported unchanged, and the agent's evolved
    // record survives byte-for-byte (NOT overwritten with the seed).
    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 1, errors: 0 })
    const stored = rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId))
    expect(stored.data).toEqual(evolved)
    expect(stored.data.evolvedByAgent).toBe(true)
  })

  it(`captures query and create failures without throwing`, async () => {
    const failingQuery = {
      query: async () => ({ error: new Error(`db down`) }),
      upsert: async () => ({ data: {} }),
    }
    const queryFail = await reconcileResidentConfigs(failingQuery as any, `pj_x`)
    expect(queryFail.errors).toBe(1)
    expect(queryFail.results[0]).toMatchObject({ action: `error` })
    expect(queryFail.results[0].message).toContain(`db down`)

    const failingUpsert = {
      query: async () => ({ data: [] }),
      upsert: async () => ({ error: new Error(`insert refused`) }),
    }
    const upsertFail = await reconcileResidentConfigs(failingUpsert as any, `pj_x`)
    expect(upsertFail.errors).toBe(1)
    expect(upsertFail.results[0].message).toContain(`insert refused`)
  })
})
