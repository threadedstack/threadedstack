import type { Schedule } from '@tdsk/domain'

import { ESandboxType, ActionsBlockFence } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── End-to-end board cycle on the primitives (Exec-Board on Primitives ⑤a-5) ──
//
// Simulates a FULL board lifecycle through the REAL ② dispatch chain:
//
//   agent stdout (```tdsk-actions``` block)
//     → dispatchActions → parseActionsBlock → invokeAction
//     → FunctionExecutor.execute → the REAL seeded Function bodies
//     → the ① `records` capability → the board Collections
//     → read back by the REAL buildContextSourcesSection for the next cycle.
//
// The schedules driving each cycle are built VERBATIM from the Phase-4 board
// defs (`AgentScheduleDefs` — same ids, agentIds, `actions` allowlists and
// `contextSources`), and the trusted caller is injected from the schedule/agent
// identity exactly as the executor does (executor.ts:1966 →
// dispatchActions(app, schedule, agent.id, stdout)). The store is seeded with
// the Phase-2 collections data (`ExecBoardRecordSeeds` — the CEO+CTO+CMO
// board_members and the empty-valid company_strategy singleton), so consensus
// requires all THREE seats.
//
// The ONLY mocks are the Phase-3 harness's three (execBoardFunctions.test.ts /
// execBoardResolve.test.ts): the V8 sandbox provider (`@tdsk/sandbox`), the
// TypeScript transpiler (`esbuild`), and the logger. The mocked isolate
// reconstructs the Function's `context` from the wrapper code, rebuilds
// `context.records` from the executor's host bridges, then imports the REAL
// body source as an ESM module (`data:` import) and executes its default
// export — the shipped body logic is what runs. There is no live DB — the
// in-memory `db.services.record` stand-in is the ① harness (with the eq/in
// query ops the bodies + context sources use), so this runs in the standard
// `pnpm --filter @tdsk/backend test` suite.
//
// The steps are ONE lifecycle and run in file order, sharing the store:
//   1. CEO strategy cycle  — upsertStrategy + openDecision
//   2. context render      — the open proposal appears WITH its record id
//   3. CTO board cycle     — postPosition (endorse)
//   3b. CMO board cycle    — postPosition (endorse; 3rd seat completes the round)
//   4. CEO board cycle     — postPosition (endorse) + closing resolveBoard
//   5. context round-trip  — committed positioning in, open decisions drained
//   6. allowlist negative  — cto-board invoking upsertStrategy = zero writes
//   7. CMO marketing cycle — saveMarketingArtifact drafts land in the Collection

const { mockClose, mockEvaluate, mockReset, mockSandbox, mockCreate } = vi.hoisted(() => {
  const mockClose = vi.fn().mockResolvedValue(undefined)
  const mockReset = vi.fn().mockResolvedValue(undefined)
  const mockEvaluate = vi.fn()
  const mockSandbox = { evaluate: mockEvaluate, close: mockClose, reset: mockReset }
  const mockCreate = vi.fn().mockResolvedValue(mockSandbox)
  return { mockClose, mockEvaluate, mockReset, mockSandbox, mockCreate }
})

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn().mockReturnValue({
    type: ESandboxType.local,
    create: mockCreate,
  }),
}))

vi.mock(`esbuild`, () => ({
  transform: vi
    .fn()
    .mockResolvedValue({ code: `const stripped = true;\nexport default stripped;` }),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// Real dispatch path + real context-source builder — nothing in either is mocked.
import { dispatchActions } from './dispatchActions'
import { buildContextSourcesSection } from './contextSources'
import { AgentScheduleDefs } from '@tdsk/database/seeds/agentSchedules'
import { ExecBoardRecordSeeds } from '@tdsk/database/seeds/exec-board/collections'
import {
  ExecBoardFunctionDefs,
  functionRecordFields,
} from '@tdsk/database/seeds/exec-board/functions'

// ── The Phase-4 board schedule defs, verbatim ────────────────────────────────

const defByKey = (key: string) => {
  const def = AgentScheduleDefs.find((entry) => entry.key === key)
  if (!def) throw new Error(`missing board schedule def: ${key}`)
  return def
}

const CeoStrategyDef = defByKey(`ceo-strategy`)
const CeoBoardDef = defByKey(`ceo-board`)
const CtoBoardDef = defByKey(`cto-board`)
const CmoBoardDef = defByKey(`cmo-board`)
const CmoMarketingDef = defByKey(`cmo-marketing`)

/** The board project every cycle is scoped to (the exec project). */
const BoardProjectId = CeoStrategyDef.projectId

/** A Schedule shaped EXACTLY like its Phase-4 def (id/agent/project/actions/sources). */
const toSchedule = (def: typeof CeoStrategyDef): Schedule =>
  ({
    id: def.id,
    orgId: def.orgId,
    agentId: def.agentId,
    projectId: def.projectId,
    contextSources: def.contextSources,
    actions: def.actions,
  }) as unknown as Schedule

const CeoStrategySchedule = toSchedule(CeoStrategyDef)
const CeoBoardSchedule = toSchedule(CeoBoardDef)
const CtoBoardSchedule = toSchedule(CtoBoardDef)
const CmoBoardSchedule = toSchedule(CmoBoardDef)
const CmoMarketingSchedule = toSchedule(CmoMarketingDef)

// ── Harness (the Phase-3 ①/② in-memory store + Function resolution) ──────────

/**
 * In-memory stand-in for the db: the ① records store (with the eq/in/ne where
 * ops the bodies use, matching the real compileRecordQuery semantics) plus the
 * `function.list` slice `invokeAction` resolves the seeded board Functions
 * through — the Phase-3 harness extended with the ② chain's resolution step
 * (dispatchActions.integration.test.ts).
 */
const makeFakeDb = () => {
  const store = new Map<string, Map<string, { id: string; data: any }>>()
  const key = (p: string, c: string) => `${p}::${c}`

  const matches = (rec: { data: any }, f: { field: string; op?: string; value: any }) => {
    const value = rec.data?.[f.field]
    if (f.op === `in`) return Array.isArray(f.value) && f.value.includes(value)
    if (f.op === `ne`) return value !== f.value
    return value === f.value
  }

  const record = {
    upsert: vi.fn(
      async (
        projectId: string,
        collection: string,
        input: { id?: string; data: any }
      ) => {
        const k = key(projectId, collection)
        if (!store.has(k)) store.set(k, new Map())
        const id = input.id ?? `rec_${store.get(k)!.size + 1}`
        store.get(k)!.set(id, { id, data: input.data })
        return { data: { id } }
      }
    ),
    query: vi.fn(
      async (
        projectId: string,
        collection: string,
        query: { where?: Array<{ field: string; op?: string; value: unknown }> } = {}
      ) => {
        let rows = Array.from(store.get(key(projectId, collection))?.values() ?? [])
        for (const f of query.where ?? []) rows = rows.filter((rec) => matches(rec, f))
        return { data: rows }
      }
    ),
    get: vi.fn(async (projectId: string, collection: string, id: string) => {
      const rec = store.get(key(projectId, collection))?.get(id)
      return rec ? { data: rec } : {}
    }),
    delete: vi.fn(async (projectId: string, collection: string, id: string) => {
      const map = store.get(key(projectId, collection))
      const rec = map?.get(id)
      map?.delete(id)
      return rec ? { data: rec } : {}
    }),
    count: vi.fn(async (projectId: string, collection: string) => ({
      data: store.get(key(projectId, collection))?.size ?? 0,
    })),
  }

  // Function resolution by (projectId, name) against the Phase-3 seeded defs —
  // what `invokeAction` calls after the allowlist gate.
  const fn = {
    list: vi.fn(async ({ where }: { where: { projectId: string; name: string } }) => ({
      data: ExecBoardFunctionDefs.filter((def) => def.name === where.name).map((def) =>
        functionRecordFields(def, where.projectId)
      ),
    })),
  }

  const seed = (collection: string, id: string, data: any) => {
    const k = key(BoardProjectId, collection)
    if (!store.has(k)) store.set(k, new Map())
    store.get(k)!.set(id, { id, data })
  }
  const rows = (collection: string) =>
    Array.from(store.get(key(BoardProjectId, collection))?.values() ?? [])
  const row = (collection: string, id: string) =>
    store.get(key(BoardProjectId, collection))?.get(id)

  return {
    db: { services: { record, function: fn } } as any,
    record,
    fn,
    seed,
    rows,
    row,
  }
}

/**
 * Reconstruct the Function's `context` object from the wrapper code the
 * executor hands the isolate — the exact technique of
 * dispatchActions.integration.test.ts (reverse the double JSON.stringify).
 */
const contextFromWrapper = (wrapper: string): Record<string, any> => {
  const match = wrapper.match(/const context = JSON\.parse\(("(?:\\.|[^"\\])*")\)/)
  if (!match) throw new Error(`could not extract context from wrapper code`)
  return JSON.parse(JSON.parse(match[1]))
}

/**
 * Rebuild `context.records` from the executor's host bridges exactly as the
 * wrapper's recordsContextCode does inside the isolate: JSON args out through
 * the bridge, JSON result parsed back.
 */
const recordsFromBridges = (
  bridges: Record<string, (json: string) => Promise<string>>
) => {
  const call = (name: string, args: unknown[]) =>
    bridges[name](JSON.stringify(args)).then((res) => JSON.parse(res))
  return {
    query: (collection: string, query?: unknown) =>
      call(`records.query`, [collection, query]),
    get: (collection: string, id: string) => call(`records.get`, [collection, id]),
    upsert: (collection: string, record: unknown) =>
      call(`records.upsert`, [collection, record]),
    delete: (collection: string, id: string) => call(`records.delete`, [collection, id]),
    count: (collection: string, query?: unknown) =>
      call(`records.count`, [collection, query]),
  }
}

/**
 * Mocked isolate that imports the REAL Function body source the executor
 * passed as the `function` module (plain-JS bodies skip esbuild) as an ESM
 * module — mirroring the wrapper's `import handler from 'function'` — then
 * EXECUTES its default export and reproduces the wrapper's success/error
 * envelope + JSON output round trip.
 */
const runRealFunctionBody = () =>
  mockEvaluate.mockImplementation(async (wrapperCode: string, opts: any) => {
    const context = contextFromWrapper(wrapperCode)
    if (opts?.bridges) context.records = recordsFromBridges(opts.bridges)
    const mod = await import(
      `data:text/javascript;base64,${Buffer.from(opts.modules.function, `utf8`).toString(`base64`)}`
    )
    try {
      const raw = await mod.default({}, context)
      return {
        output: ``,
        result: { success: true, output: JSON.parse(JSON.stringify(raw ?? null)) },
      }
    } catch (err: any) {
      return {
        output: ``,
        result: { success: false, error: err?.message || String(err) },
      }
    }
  })

const fence = (json: string) => `\`\`\`${ActionsBlockFence}\n${json}\n\`\`\``

// ── The shared lifecycle state (one store across the ordered steps) ──────────

const h = makeFakeDb()
const app = { locals: { db: h.db } } as any

// Phase-2 seed data: board_members (CEO ag_ceo0001 + CTO ag_lvUbjp_ + CMO
// ag_cmo0001) and the empty-valid company_strategy singleton (rec_strat1).
for (const seedRec of ExecBoardRecordSeeds)
  h.seed(seedRec.collection, seedRec.id, seedRec.data)

/** The record id of the proposal the CEO opens in step 1 (used from step 2 on). */
let proposalId: string

const ProposalTitle = `Reposition to AI teams`
const ProposalDescription = `Shift positioning to autonomous AI eng teams`

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockSandbox)
  mockClose.mockResolvedValue(undefined)
  mockReset.mockResolvedValue(undefined)
  runRealFunctionBody()
})

describe(`exec board cycle — end-to-end on the primitives through the ② dispatch chain (⑤a-5)`, () => {
  it(`step 0: the driving schedules carry the Phase-4 config verbatim (allowlists + context sources)`, () => {
    expect(CeoStrategyDef.actions).toEqual({
      functions: [`upsertStrategy`, `openDecision`, `upsertPlan`, `updateMilestone`],
    })
    expect(CeoBoardDef.actions).toEqual({ functions: [`postPosition`, `resolveBoard`] })
    expect(CtoBoardDef.actions).toEqual({
      functions: [`postPosition`, `reportInitiativeComplete`, `updateMilestone`],
    })
    // The CMO seat: deliberation + marketing-axis proposals, and the daily
    // drafting surface (which also owns the gtm plan). Only the CEO board
    // cycle holds resolveBoard.
    expect(CmoBoardDef.actions).toEqual({ functions: [`postPosition`, `openDecision`] })
    expect(CmoMarketingDef.actions).toEqual({
      functions: [
        `saveMarketingArtifact`,
        `openDecision`,
        `upsertPlan`,
        `updateMilestone`,
      ],
    })
    // Every board cycle reads the strategy singleton + the open decisions +
    // the active long-term plans (the planning system's context surface).
    for (const def of [
      CeoStrategyDef,
      CeoBoardDef,
      CtoBoardDef,
      CmoBoardDef,
      CmoMarketingDef,
    ]) {
      const sources = (def.contextSources ?? []).map((source) => source.as)
      expect(sources).toContain(`Company Strategy`)
      expect(sources).toContain(`Open board decisions`)
      expect(sources).toContain(`Plans`)
    }
    // The CEO/CTO seats ship LIVE on cron; the CMO runs as a RESIDENT
    // (Resident Agents R4 — seeds/resident/records.ts), so its two cron defs
    // ship disabled while their prompts/allowlists/sources (asserted above)
    // remain the single source the resident config reuses.
    expect(CeoStrategyDef.enabled).toBe(true)
    expect(CeoBoardDef.enabled).toBe(true)
    expect(CtoBoardDef.enabled).toBe(true)
    expect(CmoBoardDef.enabled).toBe(false)
    expect(CmoMarketingDef.enabled).toBe(false)
  })

  it(`step 1: CEO strategy cycle — one tdsk-actions block drives upsertStrategy + openDecision end to end`, async () => {
    const stdout = `Strategy set from this cycle's research.\n\n${fence(
      JSON.stringify([
        {
          function: `upsertStrategy`,
          args: {
            northStar: `Autonomous engineering orgs run on ThreadedStack`,
            positioning: `initial positioning`,
            backlog: [{ title: `Ship billing v2`, rationale: `revenue`, priority: 1 }],
          },
        },
        {
          function: `openDecision`,
          args: {
            title: ProposalTitle,
            axis: `positioning`,
            description: ProposalDescription,
            evidence: [`mrr-up`],
          },
        },
      ])
    )}\n\nReport complete.`

    // Caller = the schedule/agent identity, exactly as the executor injects it.
    await dispatchActions(app, CeoStrategySchedule, CeoStrategyDef.agentId, stdout)

    // Both actions resolved by name against the exec project (post-allowlist).
    expect(h.fn.list).toHaveBeenCalledWith({
      where: { projectId: BoardProjectId, name: `upsertStrategy` },
    })
    expect(h.fn.list).toHaveBeenCalledWith({
      where: { projectId: BoardProjectId, name: `openDecision` },
    })

    // The strategy singleton was patched in place (seeded fields preserved).
    const strategy = h.row(`company_strategy`, `rec_strat1`)!.data
    expect(strategy).toEqual({
      northStar: `Autonomous engineering orgs run on ThreadedStack`,
      segments: [],
      positioning: `initial positioning`,
      backlog: [{ title: `Ship billing v2`, rationale: `revenue`, priority: 1 }],
      activeInitiative: null,
      updatedByAgentId: CeoStrategyDef.agentId,
    })

    // The proposal opened: status open, round 1, opener = the trusted caller.
    const proposals = h.rows(`decision_proposals`)
    expect(proposals).toHaveLength(1)
    expect(proposals[0].data).toEqual({
      title: ProposalTitle,
      axis: `positioning`,
      description: ProposalDescription,
      evidence: [`mrr-up`],
      status: `open`,
      round: 1,
      openedByAgentId: CeoStrategyDef.agentId,
    })
    proposalId = proposals[0].id
  })

  it(`step 2: contextSources render the open proposal WITH its record id (the id fix)`, async () => {
    const section = await buildContextSourcesSection(app, CeoBoardSchedule)

    // The strategy section reflects step 1's write.
    expect(section).toContain(`## Company Strategy`)
    expect(section).toContain(`"positioning": "initial positioning"`)

    // The open proposal is rendered with its record id, so the board prompts
    // can target it in postPosition (contextSources.ts id-in-document render).
    expect(section).toContain(`## Open board decisions`)
    expect(section).toContain(`"id": "${proposalId}"`)
    expect(section).toContain(`"title": "${ProposalTitle}"`)

    // No positions posted yet.
    expect(section).toContain(`## Board positions\n(no records)`)
  })

  it(`step 3: CTO board cycle — postPosition records the CTO endorse under its own caller identity`, async () => {
    const stdout = fence(
      JSON.stringify([
        {
          function: `postPosition`,
          args: {
            proposalId,
            stance: `endorse`,
            reasoning: `the shift matches client demand`,
          },
        },
      ])
    )

    await dispatchActions(app, CtoBoardSchedule, CtoBoardDef.agentId, stdout)

    const positions = h.rows(`decision_positions`)
    expect(positions).toHaveLength(1)
    expect(positions[0].data).toEqual({
      proposalId,
      agentId: CtoBoardDef.agentId,
      stance: `endorse`,
      reasoning: `the shift matches client demand`,
      round: 1,
    })
  })

  it(`step 3b: CMO board cycle — the third seat's endorse completes the round (membership-as-data)`, async () => {
    const stdout = fence(
      JSON.stringify([
        {
          function: `postPosition`,
          args: {
            proposalId,
            stance: `endorse`,
            reasoning: `sharper positioning is the first go-to-market unlock`,
          },
        },
      ])
    )

    await dispatchActions(app, CmoBoardSchedule, CmoBoardDef.agentId, stdout)

    const positions = h.rows(`decision_positions`)
    expect(positions).toHaveLength(2)
    expect(
      positions.some(
        (rec) =>
          rec.data.agentId === CmoBoardDef.agentId &&
          rec.data.stance === `endorse` &&
          rec.data.round === 1
      )
    ).toBe(true)
  })

  it(`step 4: CEO board cycle — postPosition + closing resolveBoard commit the proposal by 3-seat consensus and run the commit effect`, async () => {
    const stdout = `Deliberation report.\n\n${fence(
      JSON.stringify([
        {
          function: `postPosition`,
          args: {
            proposalId,
            stance: `endorse`,
            reasoning: `metrics back the repositioning`,
          },
        },
        { function: `resolveBoard`, args: {} },
      ])
    )}`

    await dispatchActions(app, CeoBoardSchedule, CeoBoardDef.agentId, stdout)

    // All three members endorsed round 1 → committed by consensus at round 1.
    const proposal = h.row(`decision_proposals`, proposalId)!.data
    expect(proposal).toMatchObject({
      status: `committed`,
      resolution: `consensus`,
      round: 1,
    })

    // The commit effect ran: the positioning-axis proposal OVERWROTE the
    // strategy positioning (writer = the proposal opener), everything else kept.
    const strategy = h.row(`company_strategy`, `rec_strat1`)!.data
    expect(strategy).toEqual({
      northStar: `Autonomous engineering orgs run on ThreadedStack`,
      segments: [],
      positioning: ProposalDescription,
      backlog: [{ title: `Ship billing v2`, rationale: `revenue`, priority: 1 }],
      activeInitiative: null,
      updatedByAgentId: CeoStrategyDef.agentId,
    })
  })

  it(`step 5: context round-trip — the next cycle sees the committed positioning and a drained decision queue`, async () => {
    const section = await buildContextSourcesSection(app, CeoBoardSchedule)

    // The committed strategy state feeds the next cycle's prompt...
    expect(section).toContain(`"positioning": "${ProposalDescription}"`)
    // ...and the resolved proposal has left the open-decisions section.
    expect(section).toContain(`## Open board decisions\n(no records)`)
    // The posted positions remain visible (matched to proposals by proposalId).
    expect(section).toContain(`"proposalId": "${proposalId}"`)
  })

  it(`step 6: allowlist negative — a cto-board action naming upsertStrategy is skipped with zero writes`, async () => {
    const strategyBefore = JSON.parse(
      JSON.stringify(h.row(`company_strategy`, `rec_strat1`)!.data)
    )

    await dispatchActions(
      app,
      CtoBoardSchedule,
      CtoBoardDef.agentId,
      fence(
        JSON.stringify([
          { function: `upsertStrategy`, args: { northStar: `the CTO's hijacked north` } },
        ])
      )
    )

    // The Function is resolved (authorship — meta.authoredBy — is the second
    // authorization path), but it is neither allowlisted for the cto-board seat
    // nor authored by it, so nothing executes...
    expect(h.fn.list).toHaveBeenCalled()
    expect(mockEvaluate).not.toHaveBeenCalled()
    // ...so nothing was written anywhere.
    expect(h.record.upsert).not.toHaveBeenCalled()
    expect(h.row(`company_strategy`, `rec_strat1`)!.data).toEqual(strategyBefore)
  })

  it(`step 7: CMO marketing cycle — saveMarketingArtifact lands a draft in the marketing_artifacts Collection`, async () => {
    const stdout = `Channel research report.\n\n${fence(
      JSON.stringify([
        {
          function: `saveMarketingArtifact`,
          args: {
            kind: `ad-proposal`,
            title: `Google Ads pilot — AI eng teams`,
            body: `PROPOSAL (draft, no spend): $500/mo pilot targeting AI platform buyers.`,
            status: `proposed`,
            budget: { amountUsd: 500, period: `month`, channel: `google-ads` },
            evidence: [`channel-benchmark-source`],
          },
        },
      ])
    )}\n\nReport complete.`

    await dispatchActions(app, CmoMarketingSchedule, CmoMarketingDef.agentId, stdout)

    // Resolved by name against the exec project (post-allowlist).
    expect(h.fn.list).toHaveBeenCalledWith({
      where: { projectId: BoardProjectId, name: `saveMarketingArtifact` },
    })

    // The draft/proposal landed with the trusted caller as its writer.
    const artifacts = h.rows(`marketing_artifacts`)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].data).toEqual({
      kind: `ad-proposal`,
      title: `Google Ads pilot — AI eng teams`,
      body: `PROPOSAL (draft, no spend): $500/mo pilot targeting AI platform buyers.`,
      status: `proposed`,
      budget: { amountUsd: 500, period: `month`, channel: `google-ads` },
      evidence: [`channel-benchmark-source`],
      updatedByAgentId: CmoMarketingDef.agentId,
    })
  })
})
