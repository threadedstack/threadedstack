import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Parity tests for the board effect Functions (Exec-Board on Primitives ⑤a-3) ──
//
// Each test drives the REAL Function body source (imported from the database
// seeds) through the REAL FunctionExecutor: the mocked isolate reconstructs the
// Function's `context` from the wrapper code the executor feeds it (the same
// technique as dispatchActions.integration.test.ts), rebuilds `context.records`
// from the executor's host bridges exactly as the wrapper's recordsContextCode
// does, then imports the body source as a real ESM module (`data:` import — the
// isolate's own `import handler from 'function'`) and EXECUTES its default
// export — so these tests exercise the shipped body logic, not a
// reimplementation. The in-memory records store mirrors the ① harness
// (functionExecutor.test.ts `records capability`), extended with the eq/in
// query ops the bodies use (the real compileRecordQuery supports them).
//
// Parity sources:
//   openDecision             → persistDecisions            (executor.ts:591-659)
//   postPosition             → persistDecisionPositions    (executor.ts:668-731)
//   upsertStrategy           → persistStrategy             (executor.ts:741-780)
//   reportInitiativeComplete → persistInitiativeComplete   (executor.ts:796-877)

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

import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import { OpenDecisionFunctionDef } from '@tdsk/database/seeds/exec-board/functions/openDecision'
import { PostPositionFunctionDef } from '@tdsk/database/seeds/exec-board/functions/postPosition'
import { UpsertPlanFunctionDef } from '@tdsk/database/seeds/exec-board/functions/upsertPlan'
import { UpsertStrategyFunctionDef } from '@tdsk/database/seeds/exec-board/functions/upsertStrategy'
import { UpdateMilestoneFunctionDef } from '@tdsk/database/seeds/exec-board/functions/updateMilestone'
import { ReportInitiativeCompleteFunctionDef } from '@tdsk/database/seeds/exec-board/functions/reportInitiativeComplete'
import { SaveMarketingArtifactFunctionDef } from '@tdsk/database/seeds/exec-board/functions/saveMarketingArtifact'

// ── Harness ──────────────────────────────────────────────────────────────────

const ProjectId = `proj-board`

/**
 * In-memory stand-in for db.services.record (the ① harness), with op-aware
 * where filtering: `eq` (default) and `in`, matching the real
 * compileRecordQuery semantics for the ops the board Functions use.
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

  const seed = (collection: string, id: string, data: any) => {
    const k = key(ProjectId, collection)
    if (!store.has(k)) store.set(k, new Map())
    store.get(k)!.set(id, { id, data })
  }
  const rows = (collection: string) =>
    Array.from(store.get(key(ProjectId, collection))?.values() ?? [])
  const row = (collection: string, id: string) =>
    store.get(key(ProjectId, collection))?.get(id)

  return { db: { services: { record } } as any, record, seed, rows, row }
}

type THarness = ReturnType<typeof makeFakeDb>

/** Seed the three-seat board membership as records (getBoardMembers-as-data). */
const seedMembers = (h: THarness) => {
  h.seed(`board_members`, `bm_ceo`, { agentId: `ag_ceo`, role: `ceo`, isCEO: true })
  h.seed(`board_members`, `bm_cto`, { agentId: `ag_cto`, role: `cto`, isCEO: false })
  h.seed(`board_members`, `bm_cmo`, { agentId: `ag_cmo`, role: `cmo`, isCEO: false })
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

/** Execute a seeded board Function def through the REAL FunctionExecutor. */
const runFn = (
  def: { id: string; name: string; content: string; language: string },
  h: THarness,
  args: Record<string, unknown>,
  caller?: { agentId?: string; scheduleId?: string }
) =>
  FunctionExecutor.execute(
    { ...def, projectId: ProjectId },
    { db: h.db, context: { args, caller } }
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockSandbox)
  mockClose.mockResolvedValue(undefined)
  mockReset.mockResolvedValue(undefined)
  runRealFunctionBody()
})

// ── openDecision — parity with persistDecisions (executor.ts:591-659) ─────────

describe(`openDecision Function`, () => {
  it(`opens a proposal (status open, round 1, opener = trusted caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      OpenDecisionFunctionDef,
      h,
      {
        title: `  Reposition to AI teams  `,
        axis: `positioning`,
        description: `  Shift positioning to autonomous AI eng teams  `,
        evidence: [`ref-1`, 42],
      },
      { agentId: `ag_ceo`, scheduleId: `sd_ceo` }
    )

    expect(result.success).toBe(true)
    expect(result.output).toMatchObject({ ok: true, opened: true })

    const proposals = h.rows(`decision_proposals`)
    expect(proposals).toHaveLength(1)
    // executor.ts:625-634 — trimmed inputs, coerced evidence, open @ round 1.
    expect(proposals[0].data).toEqual({
      title: `Reposition to AI teams`,
      axis: `positioning`,
      description: `Shift positioning to autonomous AI eng teams`,
      evidence: [`ref-1`],
      status: `open`,
      round: 1,
      openedByAgentId: `ag_ceo`,
    })
  })

  it(`dedupes by trimmed lowercase title against still-open proposals (executor.ts:607-623)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    h.seed(`decision_proposals`, `dp_1`, {
      title: `Reposition to AI teams`,
      axis: `positioning`,
      description: `existing`,
      evidence: [],
      status: `deliberating`,
      round: 2,
      openedByAgentId: `ag_ceo`,
    })

    const result = await runFn(
      OpenDecisionFunctionDef,
      h,
      { title: `  reposition to ai teams `, axis: `positioning`, description: `again` },
      { agentId: `ag_cto` }
    )

    expect(result.output).toMatchObject({ ok: true, opened: false, deduped: true })
    expect(h.rows(`decision_proposals`)).toHaveLength(1)
  })

  it(`re-opens a title whose prior proposal is already resolved (dedupe is open-only)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    h.seed(`decision_proposals`, `dp_done`, {
      title: `Reposition to AI teams`,
      axis: `positioning`,
      description: `resolved`,
      evidence: [],
      status: `committed`,
      round: 1,
      openedByAgentId: `ag_ceo`,
    })

    const result = await runFn(
      OpenDecisionFunctionDef,
      h,
      { title: `Reposition to AI teams`, axis: `positioning`, description: `redo` },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toMatchObject({ ok: true, opened: true })
    expect(h.rows(`decision_proposals`)).toHaveLength(2)
  })

  it(`rejects a non-member caller even when args spoof a member id (gate reads context.caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      OpenDecisionFunctionDef,
      h,
      {
        title: `Sneaky proposal`,
        axis: `other`,
        description: `should not land`,
        // Model-emitted args claiming a member identity are ignored by the gate.
        agentId: `ag_ceo`,
        openedByAgentId: `ag_ceo`,
      },
      { agentId: `ag_intruder` }
    )

    expect(result.success).toBe(true)
    expect(result.output).toEqual({ ok: false, reason: `caller is not a board member` })
    expect(h.rows(`decision_proposals`)).toHaveLength(0)
  })

  it(`rejects an axis outside the EDecisionAxis set (parseDecisionsBlock parity)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      OpenDecisionFunctionDef,
      h,
      { title: `Bad axis`, axis: `vibes`, description: `nope` },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toEqual({ ok: false, reason: `invalid axis: vibes` })
    expect(h.rows(`decision_proposals`)).toHaveLength(0)
  })
})

// ── postPosition — parity with persistDecisionPositions (executor.ts:668-731) ─

describe(`postPosition Function`, () => {
  const seedProposal = (h: THarness, overrides: Record<string, unknown> = {}) =>
    h.seed(`decision_proposals`, `dp_1`, {
      title: `Reposition to AI teams`,
      axis: `positioning`,
      description: `desc`,
      evidence: [],
      status: `deliberating`,
      round: 2,
      openedByAgentId: `ag_ceo`,
      ...overrides,
    })

  it(`records the caller's stance at the proposal's CURRENT round (executor.ts:699-706)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h)

    const result = await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_1`, stance: `endorse`, reasoning: ` looks right ` },
      { agentId: `ag_cto` }
    )

    expect(result.output).toMatchObject({ ok: true, recorded: true })
    const positions = h.rows(`decision_positions`)
    expect(positions).toHaveLength(1)
    expect(positions[0].data).toEqual({
      proposalId: `dp_1`,
      agentId: `ag_cto`,
      stance: `endorse`,
      reasoning: `looks right`,
      round: 2,
    })
  })

  it(`replaces the same-round position (upsert key proposalId+agent+round) but keeps other rounds`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 2 })

    await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_1`, stance: `endorse`, reasoning: `first take` },
      { agentId: `ag_cto` }
    )
    await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_1`, stance: `object`, reasoning: `changed my mind` },
      { agentId: `ag_cto` }
    )

    // Same (proposal, agent, round) — replaced in place, never duplicated.
    let positions = h.rows(`decision_positions`)
    expect(positions).toHaveLength(1)
    expect(positions[0].data).toMatchObject({ stance: `object`, round: 2 })

    // The proposal advances a round — a new position is a NEW record.
    seedProposal(h, { round: 3 })
    await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_1`, stance: `endorse`, reasoning: `resolved concerns` },
      { agentId: `ag_cto` }
    )
    positions = h.rows(`decision_positions`)
    expect(positions).toHaveLength(2)
    expect(positions.map((rec) => rec.data.round).sort()).toEqual([2, 3])
  })

  it(`is a no-op on a missing or already-resolved proposal (executor.ts:687-697)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { status: `committed` })

    const closed = await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_1`, stance: `endorse`, reasoning: `too late` },
      { agentId: `ag_cto` }
    )
    expect(closed.output).toMatchObject({ ok: true, recorded: false })

    const missing = await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_ghost`, stance: `endorse`, reasoning: `no such thing` },
      { agentId: `ag_cto` }
    )
    expect(missing.output).toMatchObject({ ok: true, recorded: false })

    expect(h.rows(`decision_positions`)).toHaveLength(0)
  })

  it(`rejects a non-member caller (gate reads context.caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h)

    const result = await runFn(
      PostPositionFunctionDef,
      h,
      { proposalId: `dp_1`, stance: `endorse`, reasoning: `let me in` },
      { agentId: `ag_intruder` }
    )

    expect(result.output).toEqual({ ok: false, reason: `caller is not a board member` })
    expect(h.rows(`decision_positions`)).toHaveLength(0)
  })
})

// ── upsertStrategy — parity with persistStrategy (executor.ts:741-780) ────────

describe(`upsertStrategy Function`, () => {
  const InFlight = {
    title: `In-flight`,
    definitionOfDone: `dod`,
    evidence: [],
    status: `active`,
    committedAt: `2026-07-07T00:00:00Z`,
  }

  const seedStrategy = (h: THarness, overrides: Record<string, unknown> = {}) =>
    h.seed(`company_strategy`, `rec_strat`, {
      northStar: `old north`,
      segments: [`seg-a`],
      positioning: `old positioning`,
      backlog: [],
      activeInitiative: InFlight,
      ...overrides,
    })

  it(`lets the CEO patch strategy fields last-write-wins, preserving untouched fields`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)

    const result = await runFn(
      UpsertStrategyFunctionDef,
      h,
      {
        positioning: `  autonomous AI eng teams  `,
        backlog: [
          { title: ` Bet 1 `, rationale: ` because `, priority: 1 },
          { title: `broken`, rationale: ``, priority: 2 },
          { title: `also broken`, rationale: `r`, priority: `high` },
        ],
      },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toMatchObject({ ok: true })
    const data = h.row(`company_strategy`, `rec_strat`)!.data
    // Patched fields (trimmed; malformed backlog items dropped — parseStrategyBlock parity).
    expect(data.positioning).toBe(`autonomous AI eng teams`)
    expect(data.backlog).toEqual([{ title: `Bet 1`, rationale: `because`, priority: 1 }])
    // Untouched fields preserved (executor.ts:768 upsertByOrg patch semantics).
    expect(data.northStar).toBe(`old north`)
    expect(data.segments).toEqual([`seg-a`])
    // The Active Initiative NEVER moves through here (executor.ts:735-739).
    expect(data.activeInitiative).toEqual(InFlight)
    // The patch records its writer (executor.ts:756-764).
    expect(data.updatedByAgentId).toBe(`ag_ceo`)
  })

  it(`rejects a non-CEO board member and writes nothing (executor.ts:746 isCeoSchedule)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)
    const before = JSON.parse(
      JSON.stringify(h.row(`company_strategy`, `rec_strat`)!.data)
    )

    const result = await runFn(
      UpsertStrategyFunctionDef,
      h,
      { northStar: `the CTO's north star` },
      { agentId: `ag_cto` }
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `only the CEO may write the strategy`,
    })
    expect(h.row(`company_strategy`, `rec_strat`)!.data).toEqual(before)
  })

  it(`never touches activeInitiative, even when args try to smuggle one`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)

    await runFn(
      UpsertStrategyFunctionDef,
      h,
      {
        northStar: `new north`,
        activeInitiative: { title: `HIJACK`, status: `active` },
      },
      { agentId: `ag_ceo` }
    )

    const data = h.row(`company_strategy`, `rec_strat`)!.data
    expect(data.northStar).toBe(`new north`)
    expect(data.activeInitiative).toEqual(InFlight)
  })

  it(`rejects an update carrying no recognized strategy field (parseStrategyBlock parity)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)
    const before = JSON.parse(
      JSON.stringify(h.row(`company_strategy`, `rec_strat`)!.data)
    )

    const result = await runFn(
      UpsertStrategyFunctionDef,
      h,
      { unrelated: `field` },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toEqual({ ok: false, reason: `no recognized strategy fields` })
    expect(h.row(`company_strategy`, `rec_strat`)!.data).toEqual(before)
  })
})

// ── reportInitiativeComplete — parity with persistInitiativeComplete
//    (executor.ts:796-877) ─────────────────────────────────────────────────────

describe(`reportInitiativeComplete Function`, () => {
  const Active = {
    title: `Ship billing v2`,
    definitionOfDone: `merged+deployed+verified`,
    evidence: [`ref-1`],
    status: `active`,
    committedAt: `2026-07-07T00:00:00Z`,
  }

  const seedStrategy = (h: THarness, overrides: Record<string, unknown> = {}) =>
    h.seed(`company_strategy`, `rec_strat`, {
      northStar: `north`,
      segments: [],
      positioning: `pos`,
      backlog: [
        { title: `Next bet`, rationale: `why it matters`, priority: 1 },
        { title: `Later bet`, rationale: `later`, priority: 2 },
      ],
      activeInitiative: Active,
      ...overrides,
    })

  it(`accepts a valid CTO completion: marks complete then promotes the next backlog bet`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)

    const result = await runFn(
      ReportInitiativeCompleteFunctionDef,
      h,
      { title: `  Ship billing v2 `, evidenceRefs: [`pr-42`, 7] },
      { agentId: `ag_cto` }
    )

    expect(result.output).toMatchObject({ ok: true, advanced: true })

    // The delivered initiative was first marked complete (executor.ts:835-838)...
    const strategyWrites = h.record.upsert.mock.calls.filter(
      (call: any[]) => call[1] === `company_strategy`
    )
    expect(
      strategyWrites.some(
        (call: any[]) =>
          call[2]?.data?.activeInitiative?.title === `Ship billing v2` &&
          call[2]?.data?.activeInitiative?.status === `complete`
      )
    ).toBe(true)

    // ...then the loop advanced: the FIRST backlog bet promoted
    // (companyStrategy.promoteNextFromBacklog:139-148), dropped from the backlog.
    const data = h.row(`company_strategy`, `rec_strat`)!.data
    expect(data.activeInitiative).toEqual({
      title: `Next bet`,
      definitionOfDone: `why it matters`,
      evidence: [],
      status: `active`,
      committedAt: expect.any(String),
    })
    expect(data.backlog).toEqual([
      { title: `Later bet`, rationale: `later`, priority: 2 },
    ])
  })

  it(`clears the Active Initiative when the backlog is empty (executor.ts:842)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h, { backlog: [] })

    const result = await runFn(
      ReportInitiativeCompleteFunctionDef,
      h,
      { title: `Ship billing v2`, evidenceRefs: [`pr-42`] },
      { agentId: `ag_cto` }
    )

    expect(result.output).toMatchObject({ ok: true, advanced: true })
    expect(h.row(`company_strategy`, `rec_strat`)!.data.activeInitiative).toBeNull()
  })

  it(`refuses a title that does not match the frozen initiative exactly (executor.ts:817-830)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)

    const result = await runFn(
      ReportInitiativeCompleteFunctionDef,
      h,
      { title: `Some other work`, evidenceRefs: [`pr-42`] },
      { agentId: `ag_cto` }
    )

    expect(result.output).toMatchObject({ ok: true, advanced: false })
    // The initiative stays frozen — no advance, no completion.
    expect(h.row(`company_strategy`, `rec_strat`)!.data.activeInitiative).toEqual(Active)
  })

  it(`refuses a report with empty evidence (executor.ts:824)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)

    const result = await runFn(
      ReportInitiativeCompleteFunctionDef,
      h,
      { title: `Ship billing v2`, evidenceRefs: [] },
      { agentId: `ag_cto` }
    )

    expect(result.output).toMatchObject({ ok: true, advanced: false })
    expect(h.row(`company_strategy`, `rec_strat`)!.data.activeInitiative).toEqual(Active)
  })

  it(`rejects a non-CTO caller — even the CEO (executor.ts:801 isCtoSchedule)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedStrategy(h)

    const result = await runFn(
      ReportInitiativeCompleteFunctionDef,
      h,
      { title: `Ship billing v2`, evidenceRefs: [`pr-42`] },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `only the CTO may report initiative completion`,
    })
    expect(h.row(`company_strategy`, `rec_strat`)!.data.activeInitiative).toEqual(Active)
  })
})

// ── saveMarketingArtifact — the CMO drafting surface (board-member gated) ─────

describe(`saveMarketingArtifact Function`, () => {
  it(`creates a draft artifact (trimmed inputs, coerced evidence, writer = trusted caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      {
        kind: ` ad-proposal `,
        title: `  Google Ads pilot — AI eng teams  `,
        body: `Proposal: $500/mo pilot targeting AI platform buyers.`,
        status: `draft`,
        budget: { amountUsd: 500, period: `month`, channel: `google-ads` },
        evidence: [`benchmark-cac-source`, 42],
      },
      { agentId: `ag_cmo`, scheduleId: `sd_cmo` }
    )

    expect(result.success).toBe(true)
    expect(result.output).toMatchObject({ ok: true, saved: true, updated: false })

    const artifacts = h.rows(`marketing_artifacts`)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].data).toEqual({
      kind: `ad-proposal`,
      title: `Google Ads pilot — AI eng teams`,
      body: `Proposal: $500/mo pilot targeting AI platform buyers.`,
      status: `draft`,
      budget: { amountUsd: 500, period: `month`, channel: `google-ads` },
      evidence: [`benchmark-cac-source`],
      updatedByAgentId: `ag_cmo`,
    })
  })

  it(`dedupes by trimmed lowercase title + kind — a re-draft updates in place`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      { kind: `gtm-plan`, title: `Launch plan v1`, body: `first draft`, status: `draft` },
      { agentId: `ag_cmo` }
    )
    const result = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      {
        kind: `gtm-plan`,
        title: `  launch plan V1 `,
        body: `board-ready revision`,
        status: `proposed`,
      },
      { agentId: `ag_cmo` }
    )

    expect(result.output).toMatchObject({ ok: true, saved: true, updated: true })
    const artifacts = h.rows(`marketing_artifacts`)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].data).toMatchObject({
      title: `launch plan V1`,
      body: `board-ready revision`,
      status: `proposed`,
    })

    // A DIFFERENT kind with the same title is a new artifact, never a collision.
    await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      {
        kind: `campaign`,
        title: `Launch plan v1`,
        body: `campaign spin-off`,
        status: `draft`,
      },
      { agentId: `ag_cmo` }
    )
    expect(h.rows(`marketing_artifacts`)).toHaveLength(2)
  })

  it(`revises by explicit record id and caps the body at ~8000 chars (truncated, kept)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    h.seed(`marketing_artifacts`, `ma_1`, {
      kind: `business-plan`,
      title: `Business plan — GTM section`,
      body: `old`,
      status: `draft`,
      budget: null,
      evidence: [],
    })

    const result = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      {
        id: `ma_1`,
        kind: `business-plan`,
        title: `Business plan — GTM section`,
        body: `x`.repeat(9001),
        status: `proposed`,
      },
      { agentId: `ag_cmo` }
    )

    expect(result.output).toMatchObject({
      ok: true,
      saved: true,
      updated: true,
      artifactId: `ma_1`,
    })
    const artifacts = h.rows(`marketing_artifacts`)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].data.body).toHaveLength(8000)
    expect(artifacts[0].data.status).toBe(`proposed`)
  })

  it(`rejects an invalid status and missing required fields (nothing written)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const badStatus = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      { kind: `campaign`, title: `t`, body: `b`, status: `sent` },
      { agentId: `ag_cmo` }
    )
    expect(badStatus.output).toEqual({ ok: false, reason: `invalid status: sent` })

    const missing = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      { kind: `campaign`, title: ``, body: `b`, status: `draft` },
      { agentId: `ag_cmo` }
    )
    expect(missing.output).toEqual({
      ok: false,
      reason: `kind, title, and body are required`,
    })
    expect(h.rows(`marketing_artifacts`)).toHaveLength(0)
  })

  it(`rejects a non-member caller even when args spoof a member id (gate reads context.caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      {
        kind: `campaign`,
        title: `Sneaky campaign`,
        body: `should not land`,
        status: `draft`,
        // Model-emitted args claiming a member identity are ignored by the gate.
        agentId: `ag_cmo`,
        updatedByAgentId: `ag_cmo`,
      },
      { agentId: `ag_intruder` }
    )

    expect(result.success).toBe(true)
    expect(result.output).toEqual({ ok: false, reason: `caller is not a board member` })
    expect(h.rows(`marketing_artifacts`)).toHaveLength(0)
  })

  it(`accepts any board member as the caller (the ⑤a member gate, not a role gate)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      SaveMarketingArtifactFunctionDef,
      h,
      {
        kind: `channel-plan`,
        title: `CEO-drafted channel note`,
        body: `b`,
        status: `draft`,
      },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toMatchObject({ ok: true, saved: true })
    expect(h.rows(`marketing_artifacts`)).toHaveLength(1)
  })
})

// ── upsertPlan — the long-term planning write (board-member + role-lane gated) ─

describe(`upsertPlan Function`, () => {
  const CompanyPlanArgs = {
    kind: `company`,
    title: `  ThreadedStack 12-month plan  `,
    objective: `  Reach first paying customers  `,
    owner: `ceo`,
    status: `active`,
    keyResults: [
      { metric: ` Paying customers `, target: 10, current: 0, unit: `customers` },
      { metric: `broken — no target` },
      `not an object`,
    ],
    milestones: [
      {
        title: ` Launch plan approved `,
        status: `open`,
        estimate: `2 weeks`,
        targetDate: `2026-08-01`,
        evidence: [`ref-1`, 42],
      },
      { title: `broken — bad status`, status: `someday` },
      { status: `open` },
    ],
    linkedInitiative: ` Launch v1 `,
    notes: `Estimation basis: comparable dev-tool launches.`,
  }

  it(`creates a plan (trimmed inputs, malformed keyResults/milestones dropped, writer = trusted caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(UpsertPlanFunctionDef, h, CompanyPlanArgs, {
      agentId: `ag_ceo`,
      scheduleId: `sd_ceo`,
    })

    expect(result.success).toBe(true)
    expect(result.output).toMatchObject({ ok: true, saved: true, updated: false })

    const plans = h.rows(`plans`)
    expect(plans).toHaveLength(1)
    expect(plans[0].data).toEqual({
      kind: `company`,
      title: `ThreadedStack 12-month plan`,
      objective: `Reach first paying customers`,
      owner: `ceo`,
      status: `active`,
      keyResults: [
        { metric: `Paying customers`, target: 10, current: 0, unit: `customers` },
      ],
      milestones: [
        {
          title: `Launch plan approved`,
          status: `open`,
          estimate: `2 weeks`,
          targetDate: `2026-08-01`,
          completedAt: null,
          evidence: [`ref-1`],
        },
      ],
      linkedInitiative: `Launch v1`,
      notes: `Estimation basis: comparable dev-tool launches.`,
      updatedByAgentId: `ag_ceo`,
    })
  })

  it(`caps objective and notes at ~4000 chars (truncated, never rejected)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      UpsertPlanFunctionDef,
      h,
      {
        kind: `company`,
        title: `Long plan`,
        objective: `o`.repeat(4100),
        owner: `ceo`,
        status: `draft`,
        notes: `n`.repeat(4100),
      },
      { agentId: `ag_ceo` }
    )

    expect(result.output).toMatchObject({ ok: true, saved: true })
    const data = h.rows(`plans`)[0].data
    expect(data.objective).toHaveLength(4000)
    expect(data.notes).toHaveLength(4000)
  })

  it(`dedupes by kind + trimmed lowercase title — a re-upsert patches recognized fields only`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    await runFn(
      UpsertPlanFunctionDef,
      h,
      {
        kind: `gtm`,
        title: `GTM plan Q3`,
        objective: `First 10 customers`,
        owner: `cmo`,
        status: `draft`,
        keyResults: [{ metric: `signups`, target: 100, current: 0, unit: `users` }],
        milestones: [{ title: `Channel research done`, status: `open` }],
      },
      { agentId: `ag_cmo` }
    )
    // Same kind + case/whitespace-variant title, only status passed: everything
    // else must survive the patch (upsertStrategy last-write-wins semantics).
    const result = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `gtm`, title: `  gtm PLAN q3 `, status: `active` },
      { agentId: `ag_cmo` }
    )

    expect(result.output).toMatchObject({ ok: true, saved: true, updated: true })
    const plans = h.rows(`plans`)
    expect(plans).toHaveLength(1)
    // Passed fields land last-write-wins (title takes the new trimmed casing —
    // the saveMarketingArtifact dedupe convention); untouched fields survive.
    expect(plans[0].data).toMatchObject({
      title: `gtm PLAN q3`,
      objective: `First 10 customers`,
      status: `active`,
      keyResults: [{ metric: `signups`, target: 100, current: 0, unit: `users` }],
    })
    expect(plans[0].data.milestones).toHaveLength(1)
  })

  it(`patches by explicit record id and rejects an unknown id`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    h.seed(`plans`, `pl_1`, {
      kind: `company`,
      title: `Company plan`,
      objective: `obj`,
      owner: `ceo`,
      status: `draft`,
      keyResults: [],
      milestones: [],
      linkedInitiative: ``,
      notes: ``,
    })

    const patched = await runFn(
      UpsertPlanFunctionDef,
      h,
      { id: `pl_1`, status: `active` },
      { agentId: `ag_ceo` }
    )
    expect(patched.output).toMatchObject({
      ok: true,
      saved: true,
      updated: true,
      planId: `pl_1`,
    })
    expect(h.row(`plans`, `pl_1`)!.data).toMatchObject({
      status: `active`,
      objective: `obj`,
    })

    const missing = await runFn(
      UpsertPlanFunctionDef,
      h,
      { id: `pl_ghost`, status: `active` },
      { agentId: `ag_ceo` }
    )
    expect(missing.output).toEqual({ ok: false, reason: `plan not found: pl_ghost` })
  })

  it(`validates the role-vs-owner lane matrix (CEO any; CMO cmo+gtm; CTO cto+initiative)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    // CMO cannot own/author a company plan — the directive's reject case.
    const cmoCompany = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `company`, title: `Hijack`, objective: `o`, owner: `ceo`, status: `draft` },
      { agentId: `ag_cmo` }
    )
    expect(cmoCompany.output).toEqual({
      ok: false,
      reason: `role cmo may only write cmo-owned gtm plans`,
    })

    // CMO in-lane: cmo-owned gtm plan lands.
    const cmoGtm = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `gtm`, title: `GTM plan`, objective: `o`, owner: `cmo`, status: `active` },
      { agentId: `ag_cmo` }
    )
    expect(cmoGtm.output).toMatchObject({ ok: true, saved: true })

    // CTO out-of-lane: a gtm plan is rejected...
    const ctoGtm = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `gtm`, title: `CTO gtm`, objective: `o`, owner: `cto`, status: `draft` },
      { agentId: `ag_cto` }
    )
    expect(ctoGtm.output).toEqual({
      ok: false,
      reason: `role cto may only write cto-owned initiative plans`,
    })

    // ...but a cto-owned initiative plan lands.
    const ctoInitiative = await runFn(
      UpsertPlanFunctionDef,
      h,
      {
        kind: `initiative`,
        title: `Initiative plan`,
        objective: `o`,
        owner: `cto`,
        status: `active`,
      },
      { agentId: `ag_cto` }
    )
    expect(ctoInitiative.output).toMatchObject({ ok: true, saved: true })

    // The CEO may write any lane — including the CMO's gtm plan.
    const ceoGtm = await runFn(
      UpsertPlanFunctionDef,
      h,
      { id: h.rows(`plans`)[0].id, status: `done` },
      { agentId: `ag_ceo` }
    )
    expect(ceoGtm.output).toMatchObject({ ok: true, saved: true, updated: true })

    expect(h.rows(`plans`)).toHaveLength(2)
  })

  it(`runs the lane check on the EFFECTIVE record — a CMO cannot patch a CEO-owned plan by id`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    h.seed(`plans`, `pl_ceo`, {
      kind: `company`,
      title: `Company plan`,
      objective: `obj`,
      owner: `ceo`,
      status: `active`,
      keyResults: [],
      milestones: [],
      linkedInitiative: ``,
      notes: ``,
    })

    const result = await runFn(
      UpsertPlanFunctionDef,
      h,
      { id: `pl_ceo`, status: `dropped` },
      { agentId: `ag_cmo` }
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `role cmo may only write cmo-owned gtm plans`,
    })
    expect(h.row(`plans`, `pl_ceo`)!.data.status).toBe(`active`)
  })

  it(`rejects invalid kind/status/owner enums and incomplete creations (nothing written)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const badKind = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `vibes`, title: `t`, objective: `o`, owner: `ceo`, status: `draft` },
      { agentId: `ag_ceo` }
    )
    expect(badKind.output).toEqual({ ok: false, reason: `invalid kind: vibes` })

    const badStatus = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `company`, title: `t`, objective: `o`, owner: `ceo`, status: `paused` },
      { agentId: `ag_ceo` }
    )
    expect(badStatus.output).toEqual({ ok: false, reason: `invalid status: paused` })

    const badOwner = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `company`, title: `t`, objective: `o`, owner: `board`, status: `draft` },
      { agentId: `ag_ceo` }
    )
    expect(badOwner.output).toEqual({ ok: false, reason: `invalid owner: board` })

    // Creation without every schema-required field is rejected.
    const incomplete = await runFn(
      UpsertPlanFunctionDef,
      h,
      { kind: `company`, title: `t`, status: `draft` },
      { agentId: `ag_ceo` }
    )
    expect(incomplete.output).toEqual({
      ok: false,
      reason: `kind, title, objective, owner, and status are required to create a plan`,
    })

    // No recognized field at all is rejected (upsertStrategy parity).
    const unrecognized = await runFn(
      UpsertPlanFunctionDef,
      h,
      { unrelated: `field` },
      { agentId: `ag_ceo` }
    )
    expect(unrecognized.output).toEqual({
      ok: false,
      reason: `no recognized plan fields`,
    })

    expect(h.rows(`plans`)).toHaveLength(0)
  })

  it(`rejects a non-member caller even when args spoof a member id (gate reads context.caller)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await runFn(
      UpsertPlanFunctionDef,
      h,
      {
        kind: `company`,
        title: `Sneaky plan`,
        objective: `o`,
        owner: `ceo`,
        status: `draft`,
        agentId: `ag_ceo`,
        updatedByAgentId: `ag_ceo`,
      },
      { agentId: `ag_intruder` }
    )

    expect(result.success).toBe(true)
    expect(result.output).toEqual({ ok: false, reason: `caller is not a board member` })
    expect(h.rows(`plans`)).toHaveLength(0)
  })
})

// ── updateMilestone — the progress-tracking write (board-member gated) ────────

describe(`updateMilestone Function`, () => {
  const seedPlan = (h: THarness, overrides: Record<string, unknown> = {}) =>
    h.seed(`plans`, `pl_1`, {
      kind: `company`,
      title: `Company plan`,
      objective: `obj`,
      owner: `ceo`,
      status: `active`,
      keyResults: [
        { metric: `Paying customers`, target: 10, current: 0, unit: `customers` },
        { metric: `MRR`, target: 1000, current: 0, unit: `usd` },
      ],
      milestones: [
        {
          title: `Launch plan approved`,
          status: `open`,
          estimate: `2 weeks`,
          targetDate: `2026-08-01`,
          completedAt: null,
          evidence: [`ref-0`],
        },
        {
          title: `First customer signed`,
          status: `open`,
          estimate: ``,
          targetDate: ``,
          completedAt: null,
          evidence: [],
        },
      ],
      linkedInitiative: ``,
      notes: ``,
      ...overrides,
    })

  it(`patches the named milestone: done stamps completedAt, evidence appends, KR current advances`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedPlan(h)

    const result = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      {
        planId: `pl_1`,
        milestoneTitle: `  launch PLAN approved `,
        status: `done`,
        current: [
          { metric: ` paying CUSTOMERS `, current: 2 },
          { metric: `unknown metric`, current: 5 },
          { metric: `` },
        ],
        evidence: [`merged PR #99`, 42, `gtm artifact ma_1`],
      },
      { agentId: `ag_cto` }
    )

    expect(result.success).toBe(true)
    expect(result.output).toMatchObject({
      ok: true,
      updated: true,
      planId: `pl_1`,
      milestone: `Launch plan approved`,
      keyResultsUpdated: 1,
    })

    const data = h.row(`plans`, `pl_1`)!.data
    const done = data.milestones[0]
    expect(done.status).toBe(`done`)
    // completedAt is stamped automatically the moment status becomes done.
    expect(done.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.output).toMatchObject({ completedAt: done.completedAt })
    // Evidence APPENDS (non-strings dropped) — never replaces.
    expect(done.evidence).toEqual([`ref-0`, `merged PR #99`, `gtm artifact ma_1`])
    // KR current advanced by metric match; unknown metrics are ignored.
    expect(data.keyResults).toEqual([
      { metric: `Paying customers`, target: 10, current: 2, unit: `customers` },
      { metric: `MRR`, target: 1000, current: 0, unit: `usd` },
    ])
    // The untouched milestone is preserved; the write records its author.
    expect(data.milestones[1]).toMatchObject({ title: `First customer signed` })
    expect(data.updatedByAgentId).toBe(`ag_cto`)
  })

  it(`caps a milestone's evidence list at the most recent 20 entries`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    const existing = Array.from({ length: 19 }, (_, idx) => `ref-${idx}`)
    seedPlan(h, {
      milestones: [
        {
          title: `Launch plan approved`,
          status: `in-progress`,
          estimate: ``,
          targetDate: ``,
          completedAt: null,
          evidence: existing,
        },
      ],
    })

    await runFn(
      UpdateMilestoneFunctionDef,
      h,
      {
        planId: `pl_1`,
        milestoneTitle: `Launch plan approved`,
        evidence: [`ref-19`, `ref-20`, `ref-21`],
      },
      { agentId: `ag_ceo` }
    )

    const evidence = h.row(`plans`, `pl_1`)!.data.milestones[0].evidence
    expect(evidence).toHaveLength(20)
    // The most recent 20 survive: the oldest two rolled off.
    expect(evidence[0]).toBe(`ref-2`)
    expect(evidence[19]).toBe(`ref-21`)
  })

  it(`does not stamp completedAt for non-done statuses and preserves an existing stamp`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedPlan(h)

    await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `Launch plan approved`, status: `in-progress` },
      { agentId: `ag_cto` }
    )
    expect(h.row(`plans`, `pl_1`)!.data.milestones[0].completedAt).toBeNull()

    // A milestone already stamped keeps its original completedAt on re-done.
    seedPlan(h, {
      milestones: [
        {
          title: `Launch plan approved`,
          status: `done`,
          estimate: ``,
          targetDate: ``,
          completedAt: `2026-07-01T00:00:00.000Z`,
          evidence: [],
        },
      ],
    })
    const result = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `Launch plan approved`, status: `done` },
      { agentId: `ag_cto` }
    )
    expect(result.output).toMatchObject({ completedAt: `2026-07-01T00:00:00.000Z` })
  })

  it(`rejects a missing plan, a missing milestone, an invalid status, and an empty patch`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedPlan(h)

    const noPlan = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_ghost`, milestoneTitle: `Launch plan approved`, status: `done` },
      { agentId: `ag_cto` }
    )
    expect(noPlan.output).toEqual({ ok: false, reason: `plan not found: pl_ghost` })

    const noMilestone = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `No such milestone`, status: `done` },
      { agentId: `ag_cto` }
    )
    expect(noMilestone.output).toEqual({
      ok: false,
      reason: `milestone not found: No such milestone`,
    })

    const badStatus = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `Launch plan approved`, status: `blocked` },
      { agentId: `ag_cto` }
    )
    expect(badStatus.output).toEqual({ ok: false, reason: `invalid status: blocked` })

    const empty = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `Launch plan approved` },
      { agentId: `ag_cto` }
    )
    expect(empty.output).toEqual({
      ok: false,
      reason: `nothing to update: pass status, current, or evidence`,
    })
  })

  it(`is member-gated, not role-gated — any seat reports progress; non-members are rejected`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedPlan(h)

    // The CMO can progress a CEO-owned plan's milestone (cross-lane progress).
    const cmo = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `First customer signed`, status: `in-progress` },
      { agentId: `ag_cmo` }
    )
    expect(cmo.output).toMatchObject({ ok: true, updated: true })

    const intruder = await runFn(
      UpdateMilestoneFunctionDef,
      h,
      { planId: `pl_1`, milestoneTitle: `First customer signed`, status: `done` },
      { agentId: `ag_intruder` }
    )
    expect(intruder.output).toEqual({
      ok: false,
      reason: `caller is not a board member`,
    })
    expect(h.row(`plans`, `pl_1`)!.data.milestones[1].status).toBe(`in-progress`)
  })
})
