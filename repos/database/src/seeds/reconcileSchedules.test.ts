import { describe, it, expect, vi } from 'vitest'

import {
  AgentScheduleDefs,
  DevTaskBacklogSource,
  DevEscalationsSource,
  DevOpenProposalsSource,
  DevCoordinatorLedgerSource,
  DevVerificationsRecentSource,
  DevVerificationsInFlightSource,
} from '@TDB/seeds/agentSchedules'
import {
  needsUpdate,
  declarativeFields,
  reconcileSchedules,
} from '@TDB/seeds/reconcileSchedules'

/** A minimal in-memory schedule definition for the pure-logic tests. */
const def = (over: Record<string, unknown> = {}) => ({
  key: `planning`,
  id: `sd_x`,
  cronExpression: `0 6 * * *`,
  enabled: true,
  type: `prompt` as const,
  timeoutMs: 3_600_000,
  maxConsecutiveErrors: 6,
  agentId: `ag_1`,
  sandboxId: `sb_1`,
  orgId: `og_1`,
  projectId: `pj_1`,
  userId: `00000000-0000-0000-0000-000000000000`,
  prompt: `hello world this prompt is long enough`,
  ...over,
})

describe(`AgentScheduleDefs`, () => {
  it(`defines all 16 operating schedules (11 self-development + 5 executive-board) with unique ids and real prompts`, () => {
    expect(AgentScheduleDefs).toHaveLength(16)
    const ids = AgentScheduleDefs.map((d) => d.id)
    expect(new Set(ids).size).toBe(16)
    for (const d of AgentScheduleDefs) {
      expect(d.prompt.length).toBeGreaterThan(50)
      expect(d.type).toBe(`prompt`)
      expect(d.orgId).toBe(`og_0000001`)
      expect(d.projectId).toBe(`pj_tIly2F1`)
      expect(d.cronExpression).toMatch(/[\d*]/)
    }
  })

  it(`ships the CTO board schedule ENABLED and the CEO (R5) + CMO (R4) defs DISABLED (resident handoff)`, () => {
    const execKeys = [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d]))
    for (const key of execKeys) expect(byKey[key]).toBeDefined()
    // Only the CTO seat runs on cron; the CEO + CMO run as RESIDENTS.
    expect(byKey[`cto-board`].enabled).toBe(true)
    // The CEO runs as a RESIDENT (Resident Agents R5): its strategy cycle is the
    // resident `strategy` agenda and its board review is the `board-review`
    // agenda (seeds/resident/records.ts), so both cron defs ship disabled.
    expect(byKey[`ceo-strategy`].enabled).toBe(false)
    expect(byKey[`ceo-board`].enabled).toBe(false)
    // The CMO runs as a RESIDENT (Resident Agents R4): its marketing cycle is
    // the resident agenda and its deliberation is a decision_proposals watch
    // (seeds/resident/records.ts), so both cron defs ship disabled. The defs
    // (and their prompt files) remain — the resident config reuses them.
    expect(byKey[`cmo-board`].enabled).toBe(false)
    expect(byKey[`cmo-marketing`].enabled).toBe(false)
    // The CEO + CMO seats run on the seeded founder agents; the CTO seat reuses the steward.
    expect(byKey[`ceo-strategy`].agentId).toBe(`ag_ceo0001`)
    expect(byKey[`ceo-board`].agentId).toBe(`ag_ceo0001`)
    expect(byKey[`cto-board`].agentId).toBe(`ag_lvUbjp_`)
    expect(byKey[`cmo-board`].agentId).toBe(`ag_cmo0001`)
    expect(byKey[`cmo-marketing`].agentId).toBe(`ag_cmo0001`)
    expect(byKey[`cmo-board`].sandboxId).toBe(`sb_cmo0001`)
    expect(byKey[`cmo-marketing`].sandboxId).toBe(`sb_cmo0001`)
    // The CMO deliberation lands between the CTO's :30 and the CEO's next :00
    // resolution; the marketing cycle runs daily an hour after ceo-strategy.
    expect(byKey[`cmo-board`].cronExpression).toBe(`45 */6 * * *`)
    expect(byKey[`cmo-marketing`].cronExpression).toBe(`0 5 * * *`)
    // Every self-development schedule stays enabled.
    for (const d of AgentScheduleDefs) {
      if (!execKeys.includes(d.key)) expect(d.enabled).toBe(true)
    }
  })

  it(`wires the 5 board schedules to the board Functions + contextSources (⑤a-4)`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d]))

    // Per-role ② effect-surface allowlists — each seat may invoke only its
    // Functions. Plan authorship (upsertPlan) rides the two daily cycles (the
    // CEO's company/initiative plans, the CMO's gtm plan — the Function
    // validates owner vs the caller's board role); progress reporting
    // (updateMilestone) additionally rides the CTO board cycle.
    expect(byKey[`ceo-strategy`].actions).toEqual({
      functions: [`upsertStrategy`, `openDecision`, `upsertPlan`, `updateMilestone`],
    })
    expect(byKey[`ceo-board`].actions).toEqual({
      functions: [`postPosition`, `resolveBoard`],
    })
    expect(byKey[`cto-board`].actions).toEqual({
      functions: [`postPosition`, `reportInitiativeComplete`, `updateMilestone`],
    })
    // The CMO deliberates + may open marketing-axis proposals (mirrors how
    // ceo-strategy holds openDecision); its daily cycle drafts artifacts. Only
    // the CEO board cycle ever holds resolveBoard.
    expect(byKey[`cmo-board`].actions).toEqual({
      functions: [`postPosition`, `openDecision`],
    })
    expect(byKey[`cmo-marketing`].actions).toEqual({
      functions: [
        `saveMarketingArtifact`,
        `openDecision`,
        `upsertPlan`,
        `updateMilestone`,
      ],
    })

    // Every board cycle reads the strategy singleton + open decisions + the
    // ACTIVE long-term plans from the board Collections; the three
    // deliberation cycles additionally read positions.
    for (const key of [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]) {
      const byAs = Object.fromEntries(
        (byKey[key].contextSources ?? []).map((s) => [s.as, s])
      )
      expect(byAs[`Company Strategy`]).toMatchObject({
        collection: `company_strategy`,
        query: {},
      })
      expect(byAs[`Open board decisions`]).toMatchObject({
        collection: `decision_proposals`,
        query: {
          where: [{ field: `status`, op: `in`, value: [`open`, `deliberating`] }],
        },
      })
      expect(byAs[`Plans`]).toMatchObject({
        collection: `plans`,
        query: {
          where: [{ field: `status`, op: `eq`, value: `active` }],
          limit: 10,
        },
      })
    }
    expect(byKey[`ceo-strategy`].contextSources).toHaveLength(3)
    for (const key of [`ceo-board`, `cto-board`, `cmo-board`]) {
      expect(byKey[key].contextSources).toHaveLength(4)
      const byAs = Object.fromEntries(
        (byKey[key].contextSources ?? []).map((s) => [s.as, s])
      )
      expect(byAs[`Board positions`]).toMatchObject({
        collection: `decision_positions`,
        query: { orderBy: { field: `round`, direction: `desc` }, limit: 50 },
      })
    }
    // The marketing cycle reads its own recent artifacts (newest first via the
    // record service's default order) so it advances drafts, never duplicates.
    expect(byKey[`cmo-marketing`].contextSources).toHaveLength(4)
    const marketingByAs = Object.fromEntries(
      (byKey[`cmo-marketing`].contextSources ?? []).map((s) => [s.as, s])
    )
    expect(marketingByAs[`Recent marketing artifacts`]).toMatchObject({
      collection: `marketing_artifacts`,
      query: { limit: 20 },
    })
  })

  it(`board prompts emit one tdsk-actions block instead of the bespoke fences`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d.prompt]))
    for (const key of [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]) {
      expect(byKey[key]).toContain(`tdsk-actions`)
      expect(byKey[key]).not.toContain(`tdsk-strategy`)
      expect(byKey[key]).not.toContain(`tdsk-decisions`)
      expect(byKey[key]).not.toContain(`tdsk-decision-positions`)
      expect(byKey[key]).not.toContain(`tdsk-initiative-complete`)
    }
    // Resolution rides the CEO board cycle: its block closes with resolveBoard.
    expect(byKey[`ceo-board`]).toContain(`{"function": "resolveBoard", "args": {}}`)
    // The CTO board cycle owns the completion report + its memory write-back.
    expect(byKey[`cto-board`]).toContain(`reportInitiativeComplete`)
    expect(byKey[`cto-board`]).toContain(`tdsk-memories`)
    // The CMO cycles carry exactly their allowlisted contracts: deliberation
    // posts positions + may open marketing-axis decisions; the daily cycle
    // drafts artifacts + may open decisions. Neither ever resolves the board.
    expect(byKey[`cmo-board`]).toContain(`postPosition`)
    expect(byKey[`cmo-board`]).toContain(`openDecision`)
    expect(byKey[`cmo-board`]).not.toContain(`resolveBoard`)
    expect(byKey[`cmo-marketing`]).toContain(`saveMarketingArtifact`)
    expect(byKey[`cmo-marketing`]).toContain(`openDecision`)
    expect(byKey[`cmo-marketing`]).not.toContain(`resolveBoard`)
    expect(byKey[`cmo-board`]).toContain(`tdsk-memories`)
    expect(byKey[`cmo-marketing`]).toContain(`tdsk-memories`)
  })

  it(`carries the pre-launch go-to-market reframe + explicit research mandate in every exec prompt`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d.prompt]))
    const execKeys = [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]
    for (const key of execKeys) {
      // Company-stage reframe: zero usage = no go-to-market yet, NOT churn.
      expect(byKey[key]).toContain(`PRE-LAUNCH`)
      expect(byKey[key]).toContain(`NOT churn`)
      // Web research is an explicit faculty of every exec seat.
      expect(byKey[key]).toContain(`RESEARCH MANDATE`)
    }
    // The three deliberation prompts state the three-seat consensus rule.
    for (const key of [`ceo-board`, `cto-board`, `cmo-board`]) {
      expect(byKey[key]).toContain(`THREE seats`)
      expect(byKey[key]).toContain(`CEO/CTO/CMO`)
    }
    // The strategy prompt reorients its lanes toward go-to-market.
    expect(byKey[`ceo-strategy`]).toContain(`go-to-market`)
    // The marketing cycle ACTS in the real world (sends/publishes) — not draft-only.
    expect(byKey[`cmo-marketing`]).toContain(`ACT IN THE REAL WORLD`)
    // Both CMO prompts opt into the executive Business-metrics faculty.
    expect(byKey[`cmo-board`]).toContain(`<!-- company-strategy -->`)
    expect(byKey[`cmo-marketing`]).toContain(`<!-- company-strategy -->`)
  })

  it(`carries the PLANNING section + targeted-research rule in every exec prompt`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d.prompt]))
    const execKeys = [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]
    for (const key of execKeys) {
      // The Plans context arrives automatically; the section explains the shape.
      expect(byKey[key]).toContain(`PLANNING (long-term plans)`)
      expect(byKey[key]).toContain(`"## Plans" section arrives automatically`)
      // Plans keep the work focused: research targets open milestones only, and
      // every finding cites the milestone/keyResult it advances.
      expect(byKey[key]).toContain(`TARGETED RESEARCH RULE`)
      expect(byKey[key]).toContain(`active plans' open milestones`)
      expect(byKey[key]).toContain(`keyResult`)
    }
    // Plan authorship rides the two daily cycles; both document the real
    // Function contracts (dedupe key, lane rule, auto completedAt, evidence cap).
    for (const key of [`ceo-strategy`, `cmo-marketing`]) {
      expect(byKey[key]).toContain(`upsertPlan`)
      expect(byKey[key]).toContain(`updateMilestone`)
      expect(byKey[key]).toContain(`kind+title pair dedupes`)
      expect(byKey[key]).toContain(
        `completedAt\` is stamped automatically when it becomes done`
      )
      expect(byKey[key]).toContain(`capped at 20`)
    }
    // The CTO board cycle reports execution progress but never authors plans.
    expect(byKey[`cto-board`]).toContain(`updateMilestone`)
    expect(byKey[`cto-board`]).not.toContain(`upsertPlan`)
    // The two deliberation-only cycles hold NO plan writes — their prompts
    // reference plan progress in positions instead of documenting the writers.
    for (const key of [`ceo-board`, `cmo-board`]) {
      expect(byKey[key]).not.toContain(`upsertPlan`)
      expect(byKey[key]).not.toContain(`updateMilestone`)
      expect(byKey[key]).toContain(`references plan progress`)
    }
  })

  it(`carries the full-computer + shared-library self-provisioning framing in every exec prompt`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d.prompt]))
    const execKeys = [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]
    for (const key of execKeys) {
      // Every exec seat is told it has a full root computer with open internet —
      // the primary way it self-provisions anything it needs.
      expect(byKey[key]).toContain(`FULL COMPUTER`)
      expect(byKey[key]).toContain(`open internet`)
      // The platform primitives are a shared library, not a limit; authored
      // capability is immediately the author's to use.
      expect(byKey[key]).toContain(`SHARED LIBRARY`)
      expect(byKey[key].toLowerCase()).toContain(`authorship is authorization`)
      // The agent can build its own credential-injected connector.
      expect(byKey[key]).toContain(`tdsk-author-endpoint`)
    }
  })

  it(`keeps the 11 live dev-loop schedules free of actions + contextSources, except the ⑤b-4a/4b dual-emit allowlists`, () => {
    const execKeys = [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]
    // ⑤b-4a/4b DUAL-EMIT cutovers: each dual-emitting def carries EXACTLY the
    // Function its legacy fence mirrors — the collection records the same
    // write the legacy fence (still the authoritative table write) reports.
    // 4a: work-cycle pickups (tdsk-task-picked -> pickupTask); 4b: every
    // tdsk-tasks-emitting cycle's proposals (tdsk-tasks -> proposeTask).
    const dualEmitAllowlists: Record<string, string[]> = {
      'work-cycle': [`pickupTask`],
      planning: [`proposeTask`],
      coordinator: [`proposeTask`],
      sensor: [`proposeTask`],
    }
    const live = AgentScheduleDefs.filter((d) => !execKeys.includes(d.key))
    expect(live).toHaveLength(11)
    for (const d of live) {
      // NO contextSources on any live def: the legacy context builders stay
      // authoritative through the dual-emit transition (the sensor faculties
      // and the work cycle's backlog keep flowing via the tdsk-tasks /
      // tdsk-task-picked prompt-fence gates).
      expect(d.contextSources).toBeUndefined()
      if (d.key in dualEmitAllowlists) continue
      expect(d.actions).toBeUndefined()
      // A live DB row reads both columns back as null; null == undefined must
      // stay a no-op so the live loop never churns on deploy.
      expect(
        needsUpdate({ ...declarativeFields(d), contextSources: null, actions: null }, d)
      ).toBe(false)
    }

    for (const [key, functions] of Object.entries(dualEmitAllowlists)) {
      const d = live.find((entry) => entry.key === key)
      expect(d?.actions).toEqual({ functions })
      expect(d?.contextSources).toBeUndefined()
      // The live row (null actions) reconciles ONCE to gain the allowlist...
      expect(
        needsUpdate({ ...declarativeFields(d!), contextSources: null, actions: null }, d!)
      ).toBe(true)
      // ...then a jsonb round trip of the updated row never churns again.
      expect(needsUpdate(JSON.parse(JSON.stringify(declarativeFields(d!))), d!)).toBe(
        false
      )
    }
  })

  it(`work-cycle prompt DUAL-EMITS pickups: legacy fence AND tdsk-actions pickupTask (⑤b-4a)`, () => {
    const prompt = AgentScheduleDefs.find((d) => d.key === `work-cycle`)?.prompt ?? ``
    // The legacy fence stays verbatim — it is both the authoritative table
    // write AND the promptOptsIn gate (executor.ts:1401) that keeps the legacy
    // backlog context flowing into the cycle.
    expect(prompt).toContain(`tdsk-task-picked`)
    expect(prompt).toContain(
      `[{"proposalId":"<tp_ id exactly as shown>","prUrl":"<the PR URL you opened>","note":"<one short line>"}]`
    )
    // The transitional actions block records the SAME pickup in the Collection,
    // with the args the pickupTask Function body actually accepts.
    expect(prompt).toContain(`tdsk-actions`)
    expect(prompt).toContain(
      `[{"function":"pickupTask","args":{"proposalId":"<tp_ id exactly as shown>","prUrl":"<the PR URL you opened>","note":"<one short line>"}}]`
    )
  })

  it(`sensor/planning/coordinator prompts DUAL-EMIT proposals: legacy fence AND tdsk-actions proposeTask (⑤b-4b)`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d.prompt]))
    // The legacy fence stays verbatim — it is both the authoritative table
    // write AND the promptOptsIn gate (executor.ts:1397) that keeps the sensor
    // faculties (run outcomes + open-proposals digest) flowing into the cycles.
    for (const key of [`sensor`, `planning`, `coordinator`]) {
      expect(byKey[key]).toContain(`tdsk-tasks`)
      expect(byKey[key]).toContain(`"title":"<imperative one-line>"`)
      expect(byKey[key]).toContain(`tdsk-actions`)
    }
    // Each prompt's distinctive legacy dedupeKey placeholder survives verbatim.
    expect(byKey[`sensor`]).toContain(`"dedupeKey":"<stable key for this anomaly`)
    expect(byKey[`planning`]).toContain(`"dedupeKey":"strategy:<slug>"`)
    expect(byKey[`coordinator`]).toContain(`"dedupeKey":"initiative:<name>:child:<slug>"`)
    // The transitional actions block records the SAME proposals in the
    // Collection, with the args the proposeTask Function body actually accepts
    // — field-for-field the legacy entry's fields, per prompt.
    expect(byKey[`sensor`]).toContain(
      `[{"function":"proposeTask","args":{"title":"<same title>","description":"<same description>","priority":"<same priority>","evidence":"<same evidence>","sourceSignal":"<same sourceSignal>","dedupeKey":"<same dedupeKey>","repos":["<same repos>"]}}]`
    )
    expect(byKey[`planning`]).toContain(
      `[{"function":"proposeTask","args":{"title":"<same title>","description":"<same description>","priority":"<same priority>","evidence":"<same evidence>","sourceSignal":"other","dedupeKey":"<same dedupeKey>","initiative":"<same initiative — parent only, omit otherwise>","repos":["<same repos>"]}}]`
    )
    expect(byKey[`coordinator`]).toContain(
      `[{"function":"proposeTask","args":{"title":"<same title>","description":"<same description>","priority":"<same priority>","evidence":"<same evidence>","sourceSignal":"other","dedupeKey":"<same dedupeKey>","initiative":"<name>","parentId":"<same parentId — omit if this IS a parent>","repos":["<same repos>"]}}]`
    )
  })

  it(`keeps ALL 16 defs free of the ⑤b-3 dev-loop context sources (cutovers are Phase 4)`, () => {
    // The six source constants exist (exported for the Phase 4 cutovers + the
    // backend rendering-parity tests) but are attached to NOTHING: no def may
    // read the dev-loop workflow collections yet — the live loop still runs on
    // the hard-coded executor builders.
    const devLoopSources = [
      DevTaskBacklogSource,
      DevOpenProposalsSource,
      DevEscalationsSource,
      DevVerificationsInFlightSource,
      DevVerificationsRecentSource,
      DevCoordinatorLedgerSource,
    ]
    const devLoopCollections = new Set(devLoopSources.map((s) => s.collection))
    expect(devLoopCollections).toEqual(
      new Set([`task_proposals`, `verifications`, `escalations`])
    )

    expect(AgentScheduleDefs).toHaveLength(16)
    for (const d of AgentScheduleDefs) {
      for (const source of d.contextSources ?? []) {
        expect(devLoopSources).not.toContain(source)
        expect(devLoopCollections.has(source.collection)).toBe(false)
      }
    }
  })

  it(`board defs round-trip the reconciler without churn`, () => {
    const execKeys = [
      `ceo-strategy`,
      `ceo-board`,
      `cto-board`,
      `cmo-board`,
      `cmo-marketing`,
    ]
    for (const d of AgentScheduleDefs.filter((def) => execKeys.includes(def.key))) {
      // Simulate the DB write/read round trip (jsonb serializes the enum op to
      // its string): an unchanged row must not count as an update.
      const roundTripped = JSON.parse(JSON.stringify(declarativeFields(d)))
      expect(needsUpdate(roundTripped, d)).toBe(false)
    }
  })

  it(`carries the agnostic strategic invariants in the rewritten prompts`, () => {
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d.prompt]))
    // Coordinator is de-hard-coded: initiative resolved dynamically.
    expect(byKey[`coordinator`]).toContain(`coordinator-initiative: auto`)
    expect(byKey[`coordinator`]).not.toContain(
      `Integration test coverage for the P4 sensor`
    )
    // Planning is the generative strategist that names a current initiative.
    expect(byKey[`planning`]).toContain(`Current initiative:`)
    expect(byKey[`planning`]).toContain(`tdsk-tasks`)
    // Work cycle always ships a PR — no null cycle.
    expect(byKey[`work-cycle`]).toContain(`there is NO null cycle`)
  })
})

describe(`needsUpdate`, () => {
  it(`is false when every declarative field matches`, () => {
    const d = def()
    expect(needsUpdate({ ...d }, d)).toBe(false)
  })

  it(`is true when the prompt differs`, () => {
    const d = def()
    expect(needsUpdate({ ...d, prompt: `changed` }, d)).toBe(true)
  })

  it(`is true when the cron differs`, () => {
    const d = def()
    expect(needsUpdate({ ...d, cronExpression: `1 6 * * *` }, d)).toBe(true)
  })

  it(`is true when orgId differs`, () => {
    const d = def()
    expect(needsUpdate({ ...d, orgId: `og_other` }, d)).toBe(true)
  })

  it(`is true when projectId differs`, () => {
    const d = def()
    expect(needsUpdate({ ...d, projectId: `pj_other` }, d)).toBe(true)
  })

  it(`treats null and undefined timeoutMs as equal`, () => {
    const d = def({ timeoutMs: null })
    expect(needsUpdate({ ...d, timeoutMs: undefined }, d)).toBe(false)
  })

  it(`treats null/undefined contextSources as equal (live schedules do not churn)`, () => {
    const d = def()
    // def() sets no contextSources; a live row reads it back as null.
    expect(needsUpdate({ ...d, contextSources: null }, d)).toBe(false)
    expect(needsUpdate({ ...d, contextSources: undefined }, d)).toBe(false)
  })

  it(`is true when a schedule gains contextSources`, () => {
    const d = def({
      contextSources: [
        { collection: `proposals`, query: { limit: 5 }, as: `Open proposals` },
      ],
    })
    // Live row has none yet -> reconciler must see the added sources as a change.
    expect(needsUpdate({ ...d, contextSources: null }, d)).toBe(true)
  })

  it(`is false when contextSources match despite key-order differences`, () => {
    const d = def({
      contextSources: [{ collection: `c`, as: `A`, query: { limit: 3 } }],
    })
    // A jsonb round trip can reorder object keys; the stable comparison ignores it.
    const reordered = [{ query: { limit: 3 }, as: `A`, collection: `c` }]
    expect(needsUpdate({ ...d, contextSources: reordered }, d)).toBe(false)
  })

  it(`is true when contextSources content differs`, () => {
    const d = def({
      contextSources: [{ collection: `c`, as: `A`, query: { limit: 3 } }],
    })
    expect(
      needsUpdate(
        { ...d, contextSources: [{ collection: `c`, as: `A`, query: { limit: 9 } }] },
        d
      )
    ).toBe(true)
  })

  it(`treats null/undefined actions as equal (live schedules do not churn)`, () => {
    const d = def()
    // def() sets no actions; a live row reads it back as null.
    expect(needsUpdate({ ...d, actions: null }, d)).toBe(false)
    expect(needsUpdate({ ...d, actions: undefined }, d)).toBe(false)
  })

  it(`is true when a schedule gains actions`, () => {
    const d = def({ actions: { functions: [`f`] } })
    // Live row has none yet -> reconciler must see the added allowlist as a change.
    expect(needsUpdate({ ...d, actions: null }, d)).toBe(true)
  })

  it(`repairs a null userId (executor rejects agent-backed schedules without one)`, () => {
    const d = def()
    // Reconciler-created rows predating the userId field read back null.
    expect(needsUpdate({ ...d, userId: null }, d)).toBe(true)
    // A row already carrying the ops user does not churn.
    expect(needsUpdate({ ...d }, d)).toBe(false)
  })

  it(`ignores runtime bookkeeping fields`, () => {
    const d = def()
    expect(needsUpdate({ ...d, nextRunAt: new Date(), consecutiveErrors: 4 }, d)).toBe(
      false
    )
  })
})

describe(`declarativeFields`, () => {
  it(`includes only declarative fields, never runtime bookkeeping`, () => {
    const f = declarativeFields(def())
    expect(Object.keys(f).sort()).toEqual(
      [
        `actions`,
        `agentId`,
        `contextSources`,
        `cronExpression`,
        `enabled`,
        `id`,
        `maxConsecutiveErrors`,
        `orgId`,
        `projectId`,
        `prompt`,
        `sandboxId`,
        `timeoutMs`,
        `type`,
        `userId`,
      ].sort()
    )
    expect(f).not.toHaveProperty(`nextRunAt`)
    expect(f).not.toHaveProperty(`lastRunAt`)
    expect(f).not.toHaveProperty(`consecutiveErrors`)
  })
})

describe(`reconcileSchedules`, () => {
  it(`updates a changed row, skips an unchanged row, and creates a missing row`, async () => {
    const changed = def({ id: `sd_a`, prompt: `new prompt text` })
    const same = def({ id: `sd_b` })
    const missing = def({ id: `sd_c` })

    const get = vi.fn(async (id: string) => {
      if (id === `sd_a`) return { data: { ...changed, prompt: `old prompt text` } }
      if (id === `sd_b`) return { data: { ...same } }
      return {} // sd_c missing
    })
    const update = vi.fn(async (_item: any) => ({ data: {} }))
    const create = vi.fn(async (_item: any) => ({ data: {} }))

    const summary = await reconcileSchedules({ get, create, update }, [
      changed,
      same,
      missing,
    ])

    expect(summary).toMatchObject({ created: 1, updated: 1, unchanged: 1, errors: 0 })
    expect(update).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    // A newly created row is seeded with nextRunAt so it becomes due.
    expect(create.mock.calls[0][0]).toHaveProperty(`nextRunAt`)
    // Updates never carry runtime bookkeeping.
    expect(update.mock.calls[0][0]).not.toHaveProperty(`nextRunAt`)
  })

  it(`records an error when get fails, without throwing`, async () => {
    const get = vi.fn(async () => ({ error: new Error(`db down`) }))
    const summary = await reconcileSchedules({ get, create: vi.fn(), update: vi.fn() }, [
      def({ id: `sd_e` }),
    ])
    expect(summary.errors).toBe(1)
    expect(summary.results[0].action).toBe(`error`)
  })

  it(`records an error when update fails`, async () => {
    const d = def({ id: `sd_f`, prompt: `new` })
    const get = vi.fn(async () => ({ data: { ...d, prompt: `old` } }))
    const update = vi.fn(async () => ({ error: new Error(`nope`) }))
    const summary = await reconcileSchedules({ get, create: vi.fn(), update }, [d])
    expect(summary.errors).toBe(1)
    expect(summary.updated).toBe(0)
  })
})
