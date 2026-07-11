import { describe, it, expect } from 'vitest'

import { normalizeResidentConfig } from '@tdsk/resident/config'
import { stableStringify } from '@TDB/seeds/reconcileSchedules'
import {
  loadPrompt,
  CeoAgentId,
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
  CeoMemoriesSource,
  CtoMemoriesSource,
  DevTasksBacklogSource,
  DevTasksApprovedQuery,
  DevTasksInFlightSource,
  DevTasksReviewableQuery,
  CmoResidentConfigSeed,
  CeoResidentConfigSeed,
  CtoResidentConfigSeed,
  EngOneResidentConfigSeed,
  EngTwoResidentConfigSeed,
  ResidentConfigSeedRecords,
  reconcileResidentConfigs,
} from '@TDB/seeds/resident/records'
import { CtoAgentId, EngOneAgentId, EngTwoAgentId } from '@TDB/seeds/agentSchedules'

const cmoBoardDef = AgentScheduleDefs.find((def) => def.key === `cmo-board`)!
const cmoMarketingDef = AgentScheduleDefs.find((def) => def.key === `cmo-marketing`)!
const ceoStrategyDef = AgentScheduleDefs.find((def) => def.key === `ceo-strategy`)!
const ceoBoardDef = AgentScheduleDefs.find((def) => def.key === `ceo-board`)!
const ctoBoardDef = AgentScheduleDefs.find((def) => def.key === `cto-board`)!

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

/**
 * Pre-seed every config seed EXCEPT the excluded record ids, up to date, so a
 * reconcile scenario can focus on one seed while the rest report unchanged
 * (the reconcile processes every seed in ResidentConfigSeedRecords).
 */
const preSeedAllExcept = async (
  service: ReturnType<typeof makeFakeRecordService>[`service`],
  projectId: string,
  excludeIds: string[] = []
) => {
  for (const seed of ResidentConfigSeedRecords) {
    if (excludeIds.includes(seed.id)) continue
    await service.upsert(projectId, ResidentConfigsCollectionName, {
      id: seed.id,
      data: seed.data,
    })
  }
}

describe(`CmoResidentConfigSeed`, () => {
  it(`carries the full R4 pilot config for the CMO agent`, () => {
    expect(ResidentConfigSeedRecords).toEqual([
      CmoResidentConfigSeed,
      CeoResidentConfigSeed,
      EngOneResidentConfigSeed,
      EngTwoResidentConfigSeed,
      CtoResidentConfigSeed,
    ])
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
    expect(data.session.seedPrompt).toContain(`YOU HAVE A FULL COMPUTER`)

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

describe(`CeoResidentConfigSeed`, () => {
  it(`carries the full R5 config for the CEO agent`, () => {
    // Stable record id (rec_ prefix + 6 chars = the 10-char records.id shape).
    expect(CeoResidentConfigSeed.id).toMatch(/^rec_[A-Za-z0-9_-]{6}$/)

    const { data } = CeoResidentConfigSeed
    expect(data.agentId).toBe(CeoAgentId)

    // Agenda: the daily strategy cycle + the 3-hourly board review.
    expect(data.agenda).toHaveLength(2)
    expect(data.agenda.map((item) => item.key)).toEqual([`strategy`, `board-review`])
    expect(data.agenda[0]).toMatchObject({ key: `strategy`, cron: `0 4 * * *` })
    expect(data.agenda[1]).toMatchObject({ key: `board-review`, cron: `0 */3 * * *` })

    // Watches: exactly ONE — the slow-lane plans review.
    expect(data.watches).toHaveLength(1)
    expect(data.watches[0].key).toBe(`plans`)
    expect(data.watches[0]).toMatchObject({ collection: `plans`, debounceMs: 600_000 })

    // LOAD-BEARING R5 DESIGN PROPERTY (design-refute guard): the CEO must NOT
    // fast-watch board decisions. It holds resolveBoard, and resolution must be
    // paced by the periodic board-review agenda so it sees accrued positions
    // rather than spinning against the CTO's slower position cadence. A watch on
    // decision_proposals would collapse the openDecision (strategy) vs
    // resolveBoard (board) separation — so assert there is none.
    expect(data.watches.every((watch) => watch.collection !== `decision_proposals`)).toBe(
      true
    )

    expect(data.inbox).toEqual({ pollMs: 15_000 })
    // Explicit copies of the R2 defaults (DefaultMaxTurns / DefaultMaxBytes).
    expect(data.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
    expect(data.subAgents).toEqual({ maxConcurrent: 2 })
    expect(data.selfDirected.minIdleMs).toBe(600_000)
    // The self-directed guard: never resolve a decision opened this same turn.
    expect(data.selfDirected.prompt).toContain(
      `NEVER resolve a decision you opened this turn`
    )

    // The housekeeping map the R2 runtime dispatches through.
    expect(data.functions).toEqual({
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
      writeMemory: `writeMemory`,
    })
  })

  it(`reuses the scheduled defs' prompts and context sources verbatim`, () => {
    const { data } = CeoResidentConfigSeed

    // The two agenda items load the SAME prompt files the (still-live) ceo cron
    // defs load — one source of truth per prompt.
    expect(data.agenda[0].prompt).toBe(ceoStrategyDef.prompt)
    expect(data.agenda[1].prompt).toBe(ceoBoardDef.prompt)
    expect(data.session.seedPrompt).toBe(loadPrompt(`ceo-resident-session`))
    // The session seed carries the soul + the standing directives.
    expect(data.session.seedPrompt).toContain(`founding CEO of ThreadedStack`)
    expect(data.session.seedPrompt).toContain(`RESIDENT agent`)
    expect(data.session.seedPrompt).toContain(`BOARD RESOLUTION`)
    expect(data.session.seedPrompt).toContain(
      `NEVER resolve a decision your own turn opened`
    )
    expect(data.session.seedPrompt).toContain(`ACTIVE INITIATIVE`)

    // The board context sources plus the resident's own durable-memory recall
    // source — exact shapes, in order.
    expect(data.session.contextSources).toEqual([
      BoardStrategySource,
      BoardOpenDecisionsSource,
      BoardPositionsSource,
      BoardPlansSource,
      CeoMemoriesSource,
    ])
  })

  it(`allowlists BOTH openDecision AND resolveBoard (union) — separation is prompt-enforced`, () => {
    // The config allowlist is the UNION of the strategy cycle (opens decisions)
    // and the board cycle (resolves them). The open/resolve SEPARATION is
    // enforced by the ceo-resident-session prompt, NOT by the allowlist — both
    // capabilities live here.
    const { actions } = CeoResidentConfigSeed.data
    expect(actions).toContain(`openDecision`)
    expect(actions).toContain(`resolveBoard`)
    expect(actions).toContain(`upsertStrategy`)
    expect(actions).toContain(`postPosition`)
    expect(actions).toContain(`writeMemory`)
    // The self-directed prompt is where the same-turn open/resolve ban lives.
    expect(CeoResidentConfigSeed.data.selfDirected.prompt).toContain(
      `NEVER resolve a decision you opened this turn`
    )
  })

  it(`satisfies the R2 runtime's config parser exactly, through a jsonb round trip`, () => {
    // Simulate the record's DB write/read round trip, then run it through the
    // ACTUAL parser the resident runtime boots with — the drift guard: a field
    // rename, a bad cron, or a malformed watch in this seed fails HERE, not in
    // a prod pod.
    const roundTripped = JSON.parse(JSON.stringify(CeoResidentConfigSeed.data))
    const normalized = normalizeResidentConfig(roundTripped, CeoAgentId)

    // Nothing dropped: both agenda items and the single watch survive validation.
    expect(normalized.agenda).toEqual(
      JSON.parse(JSON.stringify(CeoResidentConfigSeed.data.agenda))
    )
    expect(normalized.agenda).toHaveLength(2)
    expect(normalized.watches).toEqual(
      JSON.parse(JSON.stringify(CeoResidentConfigSeed.data.watches))
    )
    expect(normalized.watches).toHaveLength(1)

    // Every explicit value lands verbatim; only the inbox collection default
    // is filled in (the seed deliberately omits it — agent_messages).
    expect(normalized.agentId).toBe(CeoAgentId)
    expect(normalized.inbox).toEqual({ pollMs: 15_000, collection: `agent_messages` })
    expect(normalized.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
    expect(normalized.subAgents).toEqual({ maxConcurrent: 2 })
    expect(normalized.selfDirected).toEqual(CeoResidentConfigSeed.data.selfDirected)
    expect(normalized.functions).toEqual(CeoResidentConfigSeed.data.functions)
  })
})

describe(`EngineerResidentConfigSeeds (realtime engineering team — Phase 2 shadow)`, () => {
  const seats = [
    { seed: EngOneResidentConfigSeed, agentId: EngOneAgentId },
    { seed: EngTwoResidentConfigSeed, agentId: EngTwoAgentId },
  ]

  it(`the two engineer seats are IDENTICAL apart from the agentId`, () => {
    // Swap Two's id for One's across the whole document — the result must be
    // byte-identical to One's config (a single factory builds both).
    const twoAsOne = JSON.parse(
      JSON.stringify(EngTwoResidentConfigSeed.data)
        .split(EngTwoAgentId)
        .join(EngOneAgentId)
    )
    expect(twoAsOne).toEqual(JSON.parse(JSON.stringify(EngOneResidentConfigSeed.data)))
    expect(EngOneResidentConfigSeed.id).toMatch(/^rec_[A-Za-z0-9_-]{6}$/)
    expect(EngTwoResidentConfigSeed.id).toMatch(/^rec_[A-Za-z0-9_-]{6}$/)
    expect(EngOneResidentConfigSeed.id).not.toBe(EngTwoResidentConfigSeed.id)
  })

  it(`carries the realtime watch trio, with per-seat ids hardcoded where needed`, () => {
    for (const { seed, agentId } of seats) {
      const { data } = seed
      expect(data.agentId).toBe(agentId)
      // Purely reactive + self-directed: no agenda.
      expect(data.agenda).toEqual([])

      expect(data.watches.map((watch) => watch.key)).toEqual([
        `backlog`,
        `reviews`,
        `my-changes`,
      ])
      const [backlog, reviews, myChanges] = data.watches
      for (const watch of data.watches) {
        expect(watch.collection).toBe(`dev_tasks`)
        expect(watch.debounceMs).toBe(30_000)
      }
      // The backlog watch references the SAME query object the backlog-head
      // context source carries — watched set and injected context never drift.
      expect(backlog.query).toBe(DevTasksBacklogSource.query)
      expect(reviews.query).toBe(DevTasksReviewableQuery)
      // Per-agent value filter: each seat's own id is hardcoded into its
      // my-changes query (each config is a per-agent JSON document).
      expect(myChanges.query).toEqual({
        where: [
          { field: `state`, op: `eq`, value: `changes_requested` },
          { field: `assignee`, op: `eq`, value: agentId },
        ],
        limit: 20,
      })

      // The watch prompts drive the three flows through the dev* Functions —
      // result-dependent claims are issued SYNCHRONOUSLY (dispatch curl, read
      // the result), never fire-and-forget.
      expect(backlog.prompt).toContain(`SYNCHRONOUS devClaimTask`)
      expect(backlog.prompt).toContain(`READ the result`)
      expect(backlog.prompt).toContain(`devSubmitPr`)
      expect(backlog.prompt).toContain(`pnpm types + pnpm test`)
      expect(reviews.prompt).toContain(`SYNCHRONOUS devClaimReview`)
      expect(reviews.prompt).toContain(`devCompleteReview`)
      expect(reviews.prompt).toContain(`reviewer can never equal assignee`)
      expect(reviews.prompt).toContain(`gh pr merge --admin`)
      // The recoverable verdict windows (fixed 60-minute obligation leases).
      expect(reviews.prompt).toContain(`60-minute merge lease`)
      expect(myChanges.prompt).toContain(`60-minute fix lease`)
      expect(myChanges.prompt).toContain(`devUpdatePr`)
      expect(myChanges.prompt).toContain(`stand down`)
      expect(myChanges.prompt).toContain(`reaped back to backlog`)

      expect(data.inbox).toEqual({ pollMs: 15_000 })
      expect(data.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
      expect(data.subAgents).toEqual({ maxConcurrent: 2 })
      expect(data.selfDirected.minIdleMs).toBe(600_000)
      // Review-first: an idle engineer clears a waiting peer PR before pulling
      // new backlog work (the pr_open pile is the team's worst failure mode).
      expect(data.selfDirected.prompt).toContain(`REVIEW FIRST`)
      expect(data.selfDirected.prompt).toContain(`pick up backlog work`)
      expect(data.selfDirected.prompt).toContain(`never invent work`)
    }
  })

  it(`session reuses the shared engineer seed prompt + per-seat context sources`, () => {
    for (const { seed, agentId } of seats) {
      const { session } = seed.data
      expect(session.seedPrompt).toBe(loadPrompt(`engineer-resident-session`))
      // The soul + the standing directives (the ceo-resident-session style).
      expect(session.seedPrompt).toContain(`resident engineer`)
      expect(session.seedPrompt).toContain(`RESIDENT agent`)
      expect(session.seedPrompt).toContain(
        `dev_tasks STATE MACHINE IS THE ONLY COORDINATION PATH`
      )
      expect(session.seedPrompt).toContain(`NEVER WORK WITHOUT HOLDING THE CLAIM`)
      // Result-dependent transitions are synchronous mid-turn dispatch calls
      // (read the result before acting); tdsk-actions stays fire-and-forget.
      expect(session.seedPrompt).toContain(`RESULT-DEPENDENT TRANSITIONS ARE SYNCHRONOUS`)
      expect(session.seedPrompt).toContain(
        `$TDSK_BACKEND_URL/_/orgs/$TDSK_RESIDENT_ORG_ID/projects/$TDSK_RESIDENT_PROJECT_ID/agents/$TDSK_RESIDENT_AGENT_ID/dispatch`
      )
      expect(session.seedPrompt).toContain(`Bearer $TDSK_RESIDENT_TOKEN`)
      expect(session.seedPrompt).toContain(`FIRE-AND-FORGET`)
      // Multi-turn liveness: every turn holding a claim opens with a renewal.
      expect(session.seedPrompt).toContain(`THE FIRST ACTION OF EVERY TURN`)
      expect(session.seedPrompt).toContain(`SYNCHRONOUS devRenewLease`)
      expect(session.seedPrompt).toContain(`YOU HAVE A FULL COMPUTER`)
      expect(session.seedPrompt).toContain(`THE REVIEWER MERGES`)
      expect(session.seedPrompt).toContain(`gh pr merge --admin`)
      // The shared-GitHub-identity reality + the platform independence gate,
      // stated honestly: the merge + CI checks are prompt discipline only.
      expect(session.seedPrompt).toContain(`ONE GitHub account identity`)
      expect(session.seedPrompt).toContain(`reviewer !== assignee`)
      expect(session.seedPrompt).toContain(`prompt discipline`)
      expect(session.seedPrompt).toContain(`never claim otherwise`)
      expect(session.seedPrompt).toContain(`THE SHADOW BOUNDARY IS ABSOLUTE`)
      expect(session.seedPrompt).toContain(`task_proposals`)

      // Per-seat sources: my work, my reviews, the shared backlog head, my
      // memories — the seat's own id hardcoded in the per-agent queries.
      expect(session.contextSources).toHaveLength(4)
      const [work, review, backlogHead, memories] = session.contextSources
      expect(work.collection).toBe(`dev_tasks`)
      expect(work.query.where?.[0]).toEqual({
        field: `assignee`,
        op: `eq`,
        value: agentId,
      })
      expect(review.query.where?.[0]).toEqual({
        field: `reviewer`,
        op: `eq`,
        value: agentId,
      })
      expect(backlogHead).toBe(DevTasksBacklogSource)
      expect(memories.collection).toBe(`resident_memories`)
      expect(memories.query.where?.[0]).toEqual({
        field: `agentId`,
        op: `eq`,
        value: agentId,
      })
    }
  })

  it(`allowlists the seven work-path dev* Functions + messaging + housekeeping — never grooming or reaping`, () => {
    for (const { seed } of seats) {
      expect(seed.data.actions).toEqual([
        `devClaimTask`,
        `devSubmitPr`,
        `devClaimReview`,
        `devCompleteReview`,
        `devUpdatePr`,
        `devMarkMerged`,
        `devRenewLease`,
        `sendAgentMessage`,
        `updateResidentConfig`,
        `heartbeat`,
        `appendTranscript`,
        `markMessageRead`,
        `writeMemory`,
      ])
      // Grooming, reaping, and the explicit close-out are the CTO lead's
      // duties — one owner per duty.
      expect(seed.data.actions).not.toContain(`devAddTask`)
      expect(seed.data.actions).not.toContain(`devReapExpired`)
      expect(seed.data.actions).not.toContain(`devAbandon`)
      expect(seed.data.functions).toEqual({
        heartbeat: `heartbeat`,
        appendTranscript: `appendTranscript`,
        markMessageRead: `markMessageRead`,
        writeMemory: `writeMemory`,
      })
    }
  })

  it(`satisfies the R2 runtime's config parser exactly, through a jsonb round trip`, () => {
    for (const { seed, agentId } of seats) {
      const roundTripped = JSON.parse(JSON.stringify(seed.data))
      const normalized = normalizeResidentConfig(roundTripped, agentId)

      // Nothing dropped: all three watches survive validation.
      expect(normalized.watches).toEqual(JSON.parse(JSON.stringify(seed.data.watches)))
      expect(normalized.watches).toHaveLength(3)
      expect(normalized.agenda).toHaveLength(0)

      expect(normalized.agentId).toBe(agentId)
      expect(normalized.inbox).toEqual({ pollMs: 15_000, collection: `agent_messages` })
      expect(normalized.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
      expect(normalized.subAgents).toEqual({ maxConcurrent: 2 })
      expect(normalized.selfDirected).toEqual(seed.data.selfDirected)
      expect(normalized.functions).toEqual(seed.data.functions)
    }
  })
})

describe(`CtoResidentConfigSeed (dev-team lead — Phase 2 shadow)`, () => {
  it(`rides its OWN dedicated lead agent — NEVER the steward (the R6 double-driver guard)`, () => {
    expect(CtoResidentConfigSeed.id).toMatch(/^rec_[A-Za-z0-9_-]{6}$/)
    // The dedicated dev-team lead seat (Ids.agent.cto + its body sandbox).
    expect(CtoResidentConfigSeed.data.agentId).toBe(CtoAgentId)
    // LOAD-BEARING DECOUPLING (adversarial-review guard): the lead must NOT be
    // the agent the live cto-board schedule (and the whole scheduled dev loop)
    // runs on — flipping the lead's sandbox to resident mode must never touch
    // the live dev-loop driver. The scheduled board def stays ENABLED on the
    // steward, untouched.
    expect(CtoResidentConfigSeed.data.agentId).not.toBe(ctoBoardDef.agentId)
    expect(ctoBoardDef.agentId).toBe(`ag_lvUbjp_`)
    expect(ctoBoardDef.enabled).toBe(true)
  })

  it(`agenda: hourly groom + 15-minute reap — no board cycle (the board seat stays scheduled)`, () => {
    const { agenda } = CtoResidentConfigSeed.data
    expect(agenda.map((item) => item.key)).toEqual([`groom`, `reap`])

    expect(agenda[0].cron).toBe(`0 * * * *`)
    expect(agenda[0].prompt).toContain(`devAddTask`)
    expect(agenda[0].prompt).toContain(`SMALL, sharply-scoped tasks`)
    expect(agenda[0].prompt).toContain(`ENFORCE THE SHADOW BOUNDARY`)
    expect(agenda[0].prompt).toContain(`task_proposals`)

    expect(agenda[1].cron).toBe(`*/15 * * * *`)
    // The reap is RESULT-DEPENDENT — run synchronously and read the lists.
    expect(agenda[1].prompt).toContain(`devReapExpired SYNCHRONOUSLY`)
    expect(agenda[1].prompt).toContain(`READ the returned lists`)
    // Every wedge state's recovery path is spelled out for the reconciler.
    expect(agenda[1].prompt).toContain(`approved → pr_open (re-review)`)
    expect(agenda[1].prompt).toContain(`changes_requested → backlog (rework)`)
    // The dead-task close-out is the lead's explicit act.
    expect(agenda[1].prompt).toContain(`devAbandon`)
    // The isolate never touches GitHub — the CTO reconciles with gh in its VM.
    expect(agenda[1].prompt).toContain(`gh pr view`)
    expect(agenda[1].prompt).toContain(`sendAgentMessage`)
  })

  it(`watches the approved lane for merge throughput (60s debounce)`, () => {
    const { watches } = CtoResidentConfigSeed.data
    expect(watches).toHaveLength(1)
    expect(watches[0]).toMatchObject({
      key: `approved`,
      collection: `dev_tasks`,
      debounceMs: 60_000,
    })
    expect(watches[0].query).toBe(DevTasksApprovedQuery)
    expect(watches[0].prompt).toContain(`RECORDED REVIEWER owns the merge`)
    expect(watches[0].prompt).toContain(`gh pr merge --admin`)
    expect(watches[0].prompt).toContain(`devMarkMerged`)
    // The recoverable merge window + the honest enforcement boundary.
    expect(watches[0].prompt).toContain(`60-minute merge lease`)
    expect(watches[0].prompt).toContain(`prompt discipline`)
    expect(watches[0].prompt).toContain(`reaped back to pr_open`)
  })

  it(`session carries the lead prompt + strategy/plans and dev-board context sources`, () => {
    const { session, selfDirected } = CtoResidentConfigSeed.data
    expect(session.seedPrompt).toBe(loadPrompt(`cto-resident-session`))
    expect(session.seedPrompt).toContain(`CTO of ThreadedStack`)
    expect(session.seedPrompt).toContain(`RESIDENT agent`)
    // The lead is decoupled from the board seat — it never posts positions.
    expect(session.seedPrompt).toContain(`YOU ARE THE TEAM LEAD, NOT THE BOARD SEAT`)
    expect(session.seedPrompt).toContain(`you never post positions yourself`)
    expect(session.seedPrompt).toContain(`GROOM SMALL AND BOUNDED`)
    expect(session.seedPrompt).toContain(`REAP, THEN RECONCILE AGAINST GITHUB`)
    expect(session.seedPrompt).toContain(`ABANDON IS YOURS, AND IT IS DELIBERATE`)
    expect(session.seedPrompt).toContain(`YOU LEAD, YOU DO NOT CODE THE BOARD`)
    expect(session.seedPrompt).toContain(`YOU HAVE A FULL COMPUTER`)
    expect(session.seedPrompt).toContain(`reviewer !== assignee`)
    // Result-dependent transitions run synchronously via the dispatch curl.
    expect(session.seedPrompt).toContain(`RESULT-DEPENDENT TRANSITIONS ARE SYNCHRONOUS`)
    expect(session.seedPrompt).toContain(
      `$TDSK_BACKEND_URL/_/orgs/$TDSK_RESIDENT_ORG_ID/projects/$TDSK_RESIDENT_PROJECT_ID/agents/$TDSK_RESIDENT_AGENT_ID/dispatch`
    )
    expect(session.seedPrompt).toContain(`Bearer $TDSK_RESIDENT_TOKEN`)
    // The honesty boundary: gh merge + CI checks are prompt discipline only.
    expect(session.seedPrompt).toContain(`prompt discipline`)
    expect(session.seedPrompt).toContain(`never claim otherwise`)

    expect(session.contextSources).toEqual([
      BoardStrategySource,
      BoardPlansSource,
      DevTasksInFlightSource,
      CtoMemoriesSource,
    ])

    expect(selfDirected.minIdleMs).toBe(600_000)
    expect(selfDirected.prompt).toContain(`team health`)
    expect(selfDirected.prompt).toContain(`NEVER claim, review, or merge a dev task`)
  })

  it(`allowlists ONLY the lead duties — never the engineers' or the board seat's Functions`, () => {
    const { actions } = CtoResidentConfigSeed.data
    expect(actions).toContain(`devAddTask`)
    expect(actions).toContain(`devReapExpired`)
    expect(actions).toContain(`devAbandon`)
    expect(actions).toContain(`sendAgentMessage`)
    expect(actions).toContain(`writeMemory`)
    // The lead never works its own board.
    expect(actions).not.toContain(`devClaimTask`)
    expect(actions).not.toContain(`devClaimReview`)
    expect(actions).not.toContain(`devCompleteReview`)
    expect(actions).not.toContain(`devMarkMerged`)
    // The board seat's Functions gate on board membership, which stays with
    // the steward's scheduled seat — the decoupled lead never carries them.
    for (const fn of ctoBoardDef.actions?.functions ?? [])
      expect(actions).not.toContain(fn)
  })

  it(`satisfies the R2 runtime's config parser exactly, through a jsonb round trip`, () => {
    const roundTripped = JSON.parse(JSON.stringify(CtoResidentConfigSeed.data))
    const normalized = normalizeResidentConfig(roundTripped, CtoAgentId)

    // Nothing dropped: both agenda items (incl. the */15 reap cron) and the
    // single watch survive validation.
    expect(normalized.agenda).toEqual(
      JSON.parse(JSON.stringify(CtoResidentConfigSeed.data.agenda))
    )
    expect(normalized.agenda).toHaveLength(2)
    expect(normalized.watches).toEqual(
      JSON.parse(JSON.stringify(CtoResidentConfigSeed.data.watches))
    )
    expect(normalized.watches).toHaveLength(1)

    expect(normalized.agentId).toBe(CtoAgentId)
    expect(normalized.inbox).toEqual({ pollMs: 15_000, collection: `agent_messages` })
    expect(normalized.compaction).toEqual({ maxTurns: 40, maxBytes: 400_000 })
    expect(normalized.subAgents).toEqual({ maxConcurrent: 2 })
    expect(normalized.functions).toEqual(CtoResidentConfigSeed.data.functions)
  })
})

describe(`stableStringify (reused from reconcileSchedules — single source of truth)`, () => {
  // records.ts used to carry its own private stableStringify that diverged
  // from the canonical one: null collapsed to the text "null" but undefined
  // fell through to raw JSON.stringify(undefined) (the JS value, not a
  // string), which a template literal renders as the text "undefined" — so a
  // config differing only by null-vs-undefined in a nested field reported
  // spurious drift instead of comparing equal. Now that reconcileResidentConfigs
  // imports the shared implementation, both collapse to "null" everywhere.
  it(`treats null and undefined as equal at the top level`, () => {
    expect(stableStringify(null)).toBe(stableStringify(undefined))
  })

  it(`treats null and undefined as equal for a nested field value`, () => {
    expect(stableStringify({ debounceMs: null })).toBe(
      stableStringify({ debounceMs: undefined })
    )
  })
})

describe(`reconcileResidentConfigs`, () => {
  it(`creates the CMO record when absent`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // Pre-seed every other config up to date so they reconcile as unchanged and
    // do not perturb this CMO-create scenario (the reconcile processes all).
    await preSeedAllExcept(service, `pj_ops00001`, [CmoResidentConfigSeed.id])

    const summary = await reconcileResidentConfigs(service, `pj_ops00001`)

    expect(summary).toMatchObject({ created: 1, unchanged: 4, errors: 0 })
    // results carries both seeds; assert the CMO created entry is present.
    expect(summary.results).toContainEqual({ agentId: CmoAgentId, action: `created` })
    const stored = rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId))
    expect(stored).toMatchObject({ id: CmoResidentConfigSeed.id })
    expect(stored.data).toEqual(CmoResidentConfigSeed.data)
  })

  it(`round-trips idempotently — a re-run reports unchanged and writes nothing`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // Pre-seed every other config up to date; the first reconcile then only
    // creates the CMO, and the second reconcile reports every seed unchanged.
    await preSeedAllExcept(service, `pj_ops00001`, [CmoResidentConfigSeed.id])

    await reconcileResidentConfigs(service, `pj_ops00001`)
    const snapshot = JSON.parse(JSON.stringify([...rows]))

    const second = await reconcileResidentConfigs(service, `pj_ops00001`)

    expect(second).toMatchObject({ created: 0, unchanged: 5, errors: 0 })
    expect(JSON.parse(JSON.stringify([...rows]))).toEqual(snapshot)
    expect(
      rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId)).data
    ).toEqual(CmoResidentConfigSeed.data)
  })

  it(`NEVER overwrites an agent-evolved record (evolvedByAgent marker) — the agent owns it`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // Pre-seed every other config up to date so they reconcile as unchanged
    // alongside the evolved CMO record below.
    await preSeedAllExcept(service, `pj_ops00001`, [CmoResidentConfigSeed.id])
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

    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 5, errors: 0 })
    expect(
      rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId)).data
    ).toEqual(evolved)
  })

  it(`propagates a seed update to a NOT-yet-evolved config (platform still owns it)`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // Pre-seed every other config up to date so they reconcile as unchanged
    // while the stale, platform-owned CMO config below takes the update path.
    await preSeedAllExcept(service, `pj_ops00001`, [CmoResidentConfigSeed.id])
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
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 4, errors: 0 })
    expect(summary.results).toContainEqual({ agentId: CmoAgentId, action: `updated` })
    const stored = rows.get(key(`pj_ops00001`, ResidentConfigsCollectionName, CmoAgentId))
    expect(stored.data).toEqual(CmoResidentConfigSeed.data)
    expect(stored.data.actions).toContain(`writeMemory`)
    // Record id preserved through the in-place update.
    expect(stored.id).toBe(CmoResidentConfigSeed.id)
  })

  it(`atomic guard: does NOT clobber a config the agent evolves DURING the reconcile`, async () => {
    const { service, rows, key } = makeFakeRecordService()
    // Pre-seed every other config up to date so they reconcile as unchanged
    // while the raced CMO config below exercises the atomic guard.
    await preSeedAllExcept(service, `pj_ops00001`, [CmoResidentConfigSeed.id])
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

    // The guard blocked the write: reported unchanged (CMO raced + the other
    // four up-to-date), and the agent's evolved CMO record survives
    // byte-for-byte (NOT overwritten with the seed).
    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 5, errors: 0 })
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
    // The fake errors for EVERY seed, so all five residents fail.
    expect(queryFail.errors).toBe(ResidentConfigSeedRecords.length)
    expect(queryFail.results[0]).toMatchObject({ action: `error` })
    expect(queryFail.results[0].message).toContain(`db down`)

    const failingUpsert = {
      query: async () => ({ data: [] }),
      upsert: async () => ({ error: new Error(`insert refused`) }),
    }
    const upsertFail = await reconcileResidentConfigs(failingUpsert as any, `pj_x`)
    expect(upsertFail.errors).toBe(ResidentConfigSeedRecords.length)
    expect(upsertFail.results[0].message).toContain(`insert refused`)
  })
})
