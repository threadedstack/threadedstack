import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Parity tests for the resolveBoard Function (Exec-Board on Primitives ⑤a-3) ──
//
// Mirrors EVERY case in resolveBoard.test.ts (the hard-coded engine's suite)
// against the REAL Function body source from the database seeds, executed
// through the REAL FunctionExecutor. The mocked isolate reconstructs the
// Function's `context` from the wrapper code (the dispatchActions.integration
// technique), rebuilds `context.records` from the executor's host bridges, and
// imports the body source as a real ESM module (`data:` import — the isolate's
// own `import handler from 'function'`) before executing its default export —
// so the shipped body logic itself is under test. Membership / proposals /
// positions / strategy are seeded as records, the collection shape of the
// mocked db rows the original suite injects.
//
// Parity source: resolveBoard + commitProposalEffect
// (repos/backend/src/utils/agent/resolveBoard.ts:52-250).

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
import { ResolveBoardFunctionDef } from '@tdsk/database/seeds/exec-board/functions/resolveBoard'

// ── Harness (the ① in-memory records store, with eq/in op filtering) ─────────

const ProjectId = `proj-board`

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

const contextFromWrapper = (wrapper: string): Record<string, any> => {
  const match = wrapper.match(/const context = JSON\.parse\(("(?:\\.|[^"\\])*")\)/)
  if (!match) throw new Error(`could not extract context from wrapper code`)
  return JSON.parse(JSON.parse(match[1]))
}

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

/** Run the real resolveBoard body through the executor (CEO board cycle caller). */
const resolve = (h: THarness) =>
  FunctionExecutor.execute(
    { ...ResolveBoardFunctionDef, projectId: ProjectId },
    {
      db: h.db,
      context: { args: {}, caller: { agentId: `ag_ceo`, scheduleId: `sd_ceo` } },
    }
  )

// ── Fixtures (mirroring resolveBoard.test.ts) ────────────────────────────────

const seedMembers = (h: THarness) => {
  h.seed(`board_members`, `bm_ceo`, { agentId: `ag_ceo`, role: `ceo`, isCEO: true })
  h.seed(`board_members`, `bm_cto`, { agentId: `ag_cto`, role: `cto`, isCEO: false })
}

const seedProposal = (h: THarness, overrides: Record<string, unknown> = {}) =>
  h.seed(`decision_proposals`, `dp_1`, {
    title: `Reposition to AI teams`,
    axis: `positioning`,
    description: `Shift positioning to autonomous AI eng teams`,
    evidence: [],
    status: `deliberating`,
    round: 1,
    openedByAgentId: `ag_ceo`,
    ...overrides,
  })

const seedPosition = (
  h: THarness,
  agentId: string,
  stance: string,
  round: number,
  reasoning = `because`
) =>
  h.seed(`decision_positions`, `pos_${agentId}_${round}`, {
    proposalId: `dp_1`,
    agentId,
    stance,
    reasoning,
    round,
  })

const seedStrategy = (h: THarness, data: Record<string, unknown>) =>
  h.seed(`company_strategy`, `rec_strat`, data)

const strategyData = (h: THarness) => h.row(`company_strategy`, `rec_strat`)!.data
const proposalData = (h: THarness) => h.row(`decision_proposals`, `dp_1`)!.data
const strategyWrites = (h: THarness) =>
  h.record.upsert.mock.calls.filter((call: any[]) => call[1] === `company_strategy`)

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockSandbox)
  mockClose.mockResolvedValue(undefined)
  mockReset.mockResolvedValue(undefined)
  runRealFunctionBody()
})

describe(`resolveBoard Function — consensus commit`, () => {
  it(`commits a proposal when every member endorses the current round, and runs the commit effect`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 1 })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(h, { positioning: `old`, backlog: [], activeInitiative: null })

    const result = await resolve(h)

    expect(result.success).toBe(true)
    expect(proposalData(h)).toMatchObject({
      status: `committed`,
      resolution: `consensus`,
      round: 1,
    })
    // commit effect for a positioning proposal writes the strategy positioning
    // (resolveBoard.ts:105-111, writer = the proposal opener).
    expect(strategyData(h)).toMatchObject({
      positioning: `Shift positioning to autonomous AI eng teams`,
      updatedByAgentId: `ag_ceo`,
    })
  })
})

describe(`resolveBoard Function — re-deliberate`, () => {
  it(`advances the round when a member objects under the round cap (object → next round)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 1 })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `object`, 1)

    await resolve(h)

    // advanceRound parity (decisionProposal.ts:77-95): round+1, deliberating.
    expect(proposalData(h)).toMatchObject({ round: 2, status: `deliberating` })
    expect(proposalData(h).resolution).toBeUndefined()
    // no commit effect ran
    expect(strategyWrites(h)).toHaveLength(0)
  })

  it(`commits once the members re-endorse at the advanced round`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 2 })
    seedPosition(h, `ag_ceo`, `endorse`, 2)
    seedPosition(h, `ag_cto`, `endorse`, 2)
    seedStrategy(h, { positioning: `old`, backlog: [], activeInitiative: null })

    await resolve(h)

    expect(proposalData(h)).toMatchObject({
      status: `committed`,
      resolution: `consensus`,
      round: 2,
    })
  })
})

describe(`resolveBoard Function — CEO tiebreak`, () => {
  it(`tiebreaks + commits when disagreement persists to the round cap and the CEO endorses`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 3 })
    seedPosition(h, `ag_ceo`, `endorse`, 3, `metrics back this`)
    seedPosition(h, `ag_cto`, `object`, 3)
    seedStrategy(h, { positioning: `old`, backlog: [], activeInitiative: null })

    await resolve(h)

    const data = proposalData(h)
    expect(data.status).toBe(`tiebroken`)
    expect(data.resolution).toContain(`ceo-tiebreak:`)
    expect(data.resolution).toContain(`metrics back this`)
    // tiebreak still runs the commit effect
    expect(strategyData(h).positioning).toBe(
      `Shift positioning to autonomous AI eng teams`
    )
  })

  it(`resolves a 2-member deadlock at the cap via the CEO's decisive endorse`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 3, axis: `resource-bet` })
    seedPosition(h, `ag_ceo`, `endorse`, 3)
    seedPosition(h, `ag_cto`, `amend`, 3)
    seedStrategy(h, { positioning: `x`, backlog: [], activeInitiative: null })

    await resolve(h)

    expect(proposalData(h).status).toBe(`tiebroken`)
    // other-axis commit effect: appended to the backlog one past the current
    // top (resolveBoard.ts:113-124).
    expect(strategyData(h).backlog).toEqual([
      {
        title: `Reposition to AI teams`,
        rationale: `Shift positioning to autonomous AI eng teams`,
        priority: 1,
      },
    ])
  })

  it(`rejects when the round cap is hit and the CEO objects (no commit effect)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 3 })
    seedPosition(h, `ag_ceo`, `object`, 3)
    seedPosition(h, `ag_cto`, `endorse`, 3)
    seedStrategy(h, { positioning: `old`, backlog: [], activeInitiative: null })

    await resolve(h)

    expect(proposalData(h)).toMatchObject({
      status: `rejected`,
      resolution: `ceo-tiebreak-reject`,
    })
    // a rejected proposal never touches the strategy
    expect(strategyWrites(h)).toHaveLength(0)
    expect(strategyData(h).positioning).toBe(`old`)
  })
})

describe(`resolveBoard Function — active-initiative commit gate`, () => {
  it(`sets the Active Initiative from a committed active-initiative proposal when none is in flight`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 1,
      title: `Ship billing v2`,
      description: `merged+deployed+verified`,
      evidence: [`ref-1`],
    })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(h, { positioning: `x`, backlog: [], activeInitiative: null })

    await resolve(h)

    // freeze (resolveBoard.ts:93-102).
    expect(strategyData(h).activeInitiative).toEqual({
      title: `Ship billing v2`,
      definitionOfDone: `merged+deployed+verified`,
      evidence: [`ref-1`],
      status: `active`,
      committedAt: expect.any(String),
    })
    expect(proposalData(h).status).toBe(`committed`)
  })

  // CORE STABILITY GUARANTEE: re-direction blocked until initiative-complete.
  it(`re-direction blocked until initiative-complete — a committed active-initiative swap is refused while one is active`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 1,
      title: `Pivot the loop`,
      description: `chase a shinier plan`,
    })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(h, {
      positioning: `x`,
      backlog: [],
      activeInitiative: { title: `In-flight`, status: `active` },
    })

    await resolve(h)

    // the frozen Active Initiative is never swapped mid-flight (no completion,
    // no abort) — resolveBoard.ts:65-70.
    expect(strategyData(h).activeInitiative).toEqual({
      title: `In-flight`,
      status: `active`,
    })
    expect(strategyWrites(h)).toHaveLength(0)
    const data = proposalData(h)
    expect(data.status).toBe(`committed`)
    expect(data.resolution).toContain(`blocked: active initiative in flight`)
  })

  it(`allows a new Active Initiative once the prior one is no longer active (status complete)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 1,
      title: `Next big bet`,
      description: `merged+deployed+verified`,
    })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(h, {
      positioning: `x`,
      backlog: [],
      activeInitiative: { title: `Done thing`, status: `complete` },
    })

    await resolve(h)

    expect(strategyData(h).activeInitiative).toMatchObject({
      title: `Next big bet`,
      status: `active`,
    })
  })
})

describe(`resolveBoard Function — stop-the-line abort`, () => {
  const inFlightStrategy = (backlog: any[] = []) => ({
    positioning: `x`,
    backlog,
    activeInitiative: {
      title: `In-flight`,
      definitionOfDone: `dod`,
      evidence: [],
      status: `active`,
      committedAt: `2026-07-07T00:00:00Z`,
    },
  })

  it(`stop-the-line abort winds down + promotes next — full non-CEO endorsement + wind-down note succeeds`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 1,
      title: `STOP-THE-LINE: abort the failing initiative`,
      description: `revert the merged PRs to a safe state`,
      evidence: [`error-rate-spiked`],
    })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(
      h,
      inFlightStrategy([{ title: `Recovery work`, rationale: `stabilize`, priority: 1 }])
    )

    await resolve(h)

    // the in-flight initiative is marked aborted (wound down), not left
    // dangling — resolveBoard.ts:81-84 (intermediate write)...
    expect(
      strategyWrites(h).some(
        (call: any[]) =>
          call[2]?.data?.activeInitiative?.title === `In-flight` &&
          call[2]?.data?.activeInitiative?.status === `aborted`
      )
    ).toBe(true)
    // ...then the next backlog bet is promoted (backlog non-empty) —
    // resolveBoard.ts:86-87.
    expect(strategyData(h).activeInitiative).toEqual({
      title: `Recovery work`,
      definitionOfDone: `stabilize`,
      evidence: [],
      status: `active`,
      committedAt: expect.any(String),
    })
    expect(strategyData(h).backlog).toEqual([])
    const data = proposalData(h)
    expect(data.status).toBe(`committed`)
    expect(data.resolution).toContain(`stop-the-line abort`)
    expect(data.resolution).toContain(`revert the merged PRs to a safe state`)
  })

  it(`clears the Active Initiative on abort when the backlog is empty`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 1,
      title: `Wind it down`,
      description: `finish-to-safe then stop`,
      evidence: [`stop-the-line`],
    })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(h, inFlightStrategy([]))

    await resolve(h)

    // aborted (intermediate write), then cleared (resolveBoard.ts:88).
    expect(
      strategyWrites(h).some(
        (call: any[]) => call[2]?.data?.activeInitiative?.status === `aborted`
      )
    ).toBe(true)
    expect(strategyData(h).activeInitiative).toBeNull()
  })

  it(`blocks a stop-the-line abort WITHOUT full non-CEO endorsement (CEO tiebreak cannot abort alone)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 3,
      title: `STOP-THE-LINE: force an abort`,
      description: `revert everything`,
      evidence: [`stop-the-line`],
    })
    // round cap reached; CEO endorses (would tiebreak-commit) but the CTO
    // objects, so the non-CEO high bar is NOT met (resolveBoard.ts:71-73).
    seedPosition(h, `ag_ceo`, `endorse`, 3)
    seedPosition(h, `ag_cto`, `object`, 3)
    seedStrategy(
      h,
      inFlightStrategy([{ title: `Recovery work`, rationale: `stabilize`, priority: 1 }])
    )

    await resolve(h)

    // the abort is refused: the frozen Active Initiative is untouched.
    expect(strategyWrites(h)).toHaveLength(0)
    expect(strategyData(h).activeInitiative).toMatchObject({
      title: `In-flight`,
      status: `active`,
    })
    expect(strategyData(h).backlog).toEqual([
      { title: `Recovery work`, rationale: `stabilize`, priority: 1 },
    ])
    const data = proposalData(h)
    expect(data.status).toBe(`tiebroken`)
    expect(data.resolution).toContain(
      `blocked: stop-the-line abort lacks full non-CEO endorsement`
    )
  })

  it(`blocks a stop-the-line abort with no wind-down plan (empty description)`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, {
      axis: `active-initiative`,
      round: 1,
      title: `STOP-THE-LINE: abort`,
      description: ``,
      evidence: [`stop-the-line`],
    })
    seedPosition(h, `ag_ceo`, `endorse`, 1)
    seedPosition(h, `ag_cto`, `endorse`, 1)
    seedStrategy(h, inFlightStrategy([]))

    await resolve(h)

    // refused (resolveBoard.ts:74-77): initiative untouched, note recorded.
    expect(strategyWrites(h)).toHaveLength(0)
    expect(strategyData(h).activeInitiative).toMatchObject({
      title: `In-flight`,
      status: `active`,
    })
    expect(proposalData(h).resolution).toContain(
      `blocked: stop-the-line abort has no wind-down plan`
    )
  })
})

describe(`resolveBoard Function — waiting`, () => {
  it(`does nothing when a member has not yet positioned at the current round`, async () => {
    const h = makeFakeDb()
    seedMembers(h)
    seedProposal(h, { round: 1 })
    seedPosition(h, `ag_ceo`, `endorse`, 1)

    await resolve(h)

    // no resolution, no advance — the proposal is untouched.
    expect(proposalData(h)).toMatchObject({ status: `deliberating`, round: 1 })
    expect(proposalData(h).resolution).toBeUndefined()
    expect(strategyWrites(h)).toHaveLength(0)
  })

  it(`returns early with no open proposals`, async () => {
    const h = makeFakeDb()
    seedMembers(h)

    const result = await resolve(h)

    expect(result.output).toEqual({ ok: true, resolved: 0 })
    // positions are never even queried (resolveBoard.ts:173 early return).
    expect(
      h.record.query.mock.calls.some((call: any[]) => call[1] === `decision_positions`)
    ).toBe(false)
    expect(h.record.upsert).not.toHaveBeenCalled()
  })
})
