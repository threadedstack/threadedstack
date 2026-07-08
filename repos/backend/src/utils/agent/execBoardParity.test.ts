import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DecisionsBlockFence, DecisionPositionsBlockFence } from '@tdsk/domain'

// ── Cross-path parity: primitives vs hard-coded exec handlers (⑤a-5) ──────────
//
// The gate before Phase 6 retires the hard-coded handlers: for fixed board
// scenarios, BOTH paths run end to end and must land the IDENTICAL end-state.
//
//   Primitive path  — the REAL seeded Function bodies (openDecision /
//     postPosition / resolveBoard) executed through the REAL FunctionExecutor
//     against the ① in-memory records store (the Phase-3 harness:
//     execBoardFunctions.test.ts / execBoardResolve.test.ts).
//   Hard-coded path — persistDecisions + persistDecisionPositions
//     (executor.ts) and resolveBoard + commitProposalEffect (resolveBoard.ts)
//     against stateful mocks of their db services, mirroring the mocking style
//     + fixtures of the existing resolveBoard.test.ts / executor.board.test.ts
//     suites but applying each call's documented mutation (decisionProposal.
//     advanceRound = round+1 + deliberating, decisionPosition.latestByProposal
//     = latest per agent by round asc, companyStrategy.upsertByOrg = patch) so
//     an END-STATE exists to compare.
//
// Both paths use the REAL board membership: the hard-coded path reads the real
// @TBE/constants/board getBoardMembers() (ag_ceo0001 CEO + ag_lvUbjp_ CTO, NOT
// mocked here), and the primitive path seeds the Phase-2 board_members records
// (ExecBoardRecordSeeds) — a precondition test pins the two sources equal.
//
// Envelopes differ (table row vs record.data), so the comparison is
// field-for-field on the semantic fields — proposal status / resolution /
// round + strategy positioning / backlog / activeInitiative /
// updatedByAgentId — with the resolution strings (`consensus`,
// `ceo-tiebreak: <reasoning>`, `ceo-tiebreak-reject`, blocked notes) asserted
// BYTE-EQUAL across the paths.

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

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the persist* handlers never pulls in the heavy agent runtime
// (the executor.board.test.ts pattern).
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

// The hard-coded path — real handlers, real board constants (membership NOT mocked).
import { resolveBoard } from './resolveBoard'
import {
  persistDecisions,
  persistDecisionPositions,
} from '@TBE/services/scheduler/executor'
import { getBoardMembers, BoardCeoAgentId, BoardCtoAgentId } from '@TBE/constants/board'

// The primitive path — real FunctionExecutor + the real seeded Function bodies.
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import { ExecBoardRecordSeeds } from '@tdsk/database/seeds/exec-board/collections'
import { OpenDecisionFunctionDef } from '@tdsk/database/seeds/exec-board/functions/openDecision'
import { PostPositionFunctionDef } from '@tdsk/database/seeds/exec-board/functions/postPosition'
import { ResolveBoardFunctionDef } from '@tdsk/database/seeds/exec-board/functions/resolveBoard'

// ── Primitive-path harness (the Phase-3 ① in-memory records store) ───────────

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

  return { db: { services: { record } } as any, record, seed, rows }
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

const runFn = (
  def: { id: string; name: string; content: string; language: string },
  h: THarness,
  args: Record<string, unknown>,
  caller: { agentId: string }
) =>
  FunctionExecutor.execute(
    { ...def, projectId: ProjectId },
    { db: h.db, context: { args, caller } }
  )

/** Seed the Phase-2 board_members records + a scenario strategy singleton. */
const seedPrimitiveBoard = (h: THarness, strategy: Record<string, any>) => {
  for (const rec of ExecBoardRecordSeeds)
    if (rec.collection === `board_members`) h.seed(rec.collection, rec.id, rec.data)
  h.seed(`company_strategy`, `rec_strat1`, JSON.parse(JSON.stringify(strategy)))
}

// Primitive-path drivers (the same 3 board Functions the schedules allowlist).
const openPrimitive = (h: THarness, proposal: Record<string, unknown>) =>
  runFn(OpenDecisionFunctionDef, h, proposal, { agentId: BoardCeoAgentId })
const postPrimitive = (
  h: THarness,
  agentId: string,
  proposalId: string,
  stance: string,
  reasoning: string
) => runFn(PostPositionFunctionDef, h, { proposalId, stance, reasoning }, { agentId })
const resolvePrimitive = (h: THarness) =>
  runFn(ResolveBoardFunctionDef, h, {}, { agentId: BoardCeoAgentId })

// ── Hard-coded-path harness (stateful mocks of the handler services) ─────────

const OrgId = `og_0000001`

/** CEO board schedule — the identity resolveBoard + persist* gate on. */
const ceoSchedule = {
  id: `sd_ceobrd1`,
  orgId: OrgId,
  agentId: BoardCeoAgentId,
  prompt: `board cycle`,
} as any

/** CTO board schedule — the steward-agent seat. */
const ctoSchedule = {
  id: `sd_ctobrd1`,
  orgId: OrgId,
  agentId: BoardCtoAgentId,
  prompt: `board cycle`,
} as any

/**
 * Stateful in-memory implementation of the exact service slices the hard-coded
 * path calls, each applying its documented mutation:
 *   decisionProposal.create/listOpenByOrg/get/update, advanceRound (round+1 +
 *   status deliberating — decisionProposal.ts advanceRound), decisionPosition.
 *   create + latestByProposal (latest per agent, round asc — decisionPosition.ts),
 *   companyStrategy.getByOrg/upsertByOrg (patch)/setActiveInitiative/
 *   promoteNextFromBacklog/clearActiveInitiative.
 */
const makeHardcodedDb = (strategy0: Record<string, any>) => {
  const state = {
    proposals: [] as any[],
    positions: [] as any[],
    strategy: JSON.parse(JSON.stringify(strategy0)) as Record<string, any>,
  }
  let proposalSeq = 0

  const services = {
    decisionProposal: {
      create: vi.fn(async (input: any) => {
        const row = { id: `dp_${++proposalSeq}`, ...input }
        state.proposals.push(row)
        return { data: row }
      }),
      listOpenByOrg: vi.fn(async (_orgId: string) => ({
        data: state.proposals.filter(
          (row) => row.status === `open` || row.status === `deliberating`
        ),
      })),
      get: vi.fn(async (id: string) => ({
        data: state.proposals.find((row) => row.id === id),
      })),
      update: vi.fn(async (patch: any) => {
        const row = state.proposals.find((entry) => entry.id === patch.id)
        Object.assign(row, patch)
        return { data: row }
      }),
      advanceRound: vi.fn(async (id: string) => {
        const row = state.proposals.find((entry) => entry.id === id)
        row.round += 1
        row.status = `deliberating`
        return { data: row }
      }),
    },
    decisionPosition: {
      create: vi.fn(async (input: any) => {
        state.positions.push({ id: `dpos_${state.positions.length + 1}`, ...input })
        return { data: {} }
      }),
      latestByProposal: vi.fn(async (proposalId: string) => {
        const rows = state.positions
          .filter((row) => row.proposalId === proposalId)
          .slice()
          .sort((a, b) => a.round - b.round)
        const latest = new Map<string, any>()
        for (const row of rows) latest.set(row.agentId, row)
        return { data: [...latest.values()] }
      }),
    },
    companyStrategy: {
      getByOrg: vi.fn(async () => ({ data: state.strategy })),
      upsertByOrg: vi.fn(async (_orgId: string, patch: any) => {
        Object.assign(state.strategy, patch)
        return { data: state.strategy }
      }),
      setActiveInitiative: vi.fn(async (_orgId: string, initiative: any) => {
        state.strategy.activeInitiative = initiative
        return { data: state.strategy }
      }),
      promoteNextFromBacklog: vi.fn(async () => {
        const backlog = state.strategy.backlog ?? []
        const next = backlog[0]
        state.strategy.activeInitiative = {
          title: next.title,
          definitionOfDone: next.rationale,
          evidence: [],
          status: `active`,
          committedAt: new Date().toISOString(),
        }
        state.strategy.backlog = backlog.slice(1)
        return { data: state.strategy }
      }),
      clearActiveInitiative: vi.fn(async () => {
        state.strategy.activeInitiative = null
        return { data: state.strategy }
      }),
    },
  }

  return { app: { locals: { db: { services } } } as any, state, services }
}

type THardcoded = ReturnType<typeof makeHardcodedDb>

const fenced = (fence: string, payload: unknown) =>
  `preamble text\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

// Hard-coded-path drivers (the persist* handlers + the resolveBoard engine).
const openHardcoded = (hc: THardcoded, proposal: Record<string, unknown>) =>
  persistDecisions(hc.app, ceoSchedule, fenced(DecisionsBlockFence, [proposal]))
const postHardcoded = (
  hc: THardcoded,
  schedule: any,
  proposalId: string,
  stance: string,
  reasoning: string
) =>
  persistDecisionPositions(
    hc.app,
    schedule,
    fenced(DecisionPositionsBlockFence, [{ proposalId, stance, reasoning }])
  )
const resolveHardcoded = (hc: THardcoded) => resolveBoard(hc.app, ceoSchedule)

// ── End-state extraction + field-for-field comparison ────────────────────────

type TEndState = {
  proposal: { status: string; resolution?: string; round: number }
  strategy: Record<string, any>
}

const primitiveEnd = (h: THarness): TEndState => {
  const proposal = h.rows(`decision_proposals`)[0].data
  return {
    proposal: {
      status: proposal.status,
      resolution: proposal.resolution,
      round: proposal.round,
    },
    strategy: h.rows(`company_strategy`)[0].data,
  }
}

const hardcodedEnd = (hc: THardcoded): TEndState => {
  const proposal = hc.state.proposals[0]
  return {
    proposal: {
      status: proposal.status,
      resolution: proposal.resolution,
      round: proposal.round,
    },
    strategy: hc.state.strategy,
  }
}

/**
 * The parity gate: the semantic proposal fields and every strategy field the
 * commit effects can touch must be IDENTICAL across the paths — with the
 * resolution string compared byte-equal.
 */
const expectParity = (primitive: TEndState, hardcoded: TEndState) => {
  expect(primitive.proposal.status).toBe(hardcoded.proposal.status)
  expect(primitive.proposal.resolution).toBe(hardcoded.proposal.resolution)
  expect(primitive.proposal.round).toBe(hardcoded.proposal.round)
  expect(primitive.strategy.positioning).toBe(hardcoded.strategy.positioning)
  expect(primitive.strategy.backlog ?? []).toEqual(hardcoded.strategy.backlog ?? [])
  expect(primitive.strategy.activeInitiative ?? null).toEqual(
    hardcoded.strategy.activeInitiative ?? null
  )
  expect(primitive.strategy.updatedByAgentId).toBe(hardcoded.strategy.updatedByAgentId)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockSandbox)
  mockClose.mockResolvedValue(undefined)
  mockReset.mockResolvedValue(undefined)
  runRealFunctionBody()
})

// ── Scenarios ────────────────────────────────────────────────────────────────

describe(`exec board cross-path parity — primitives vs hard-coded handlers (⑤a-5)`, () => {
  it(`precondition: the Phase-2 board_members seed data IS the hard-coded getBoardMembers() membership`, () => {
    const seeded = ExecBoardRecordSeeds.filter(
      (rec) => rec.collection === `board_members`
    ).map((rec) => rec.data)
    expect(seeded).toEqual(getBoardMembers())
  })

  it(`consensus commit on the positioning axis lands the identical end-state on both paths`, async () => {
    const Proposal = {
      title: `Reposition to AI teams`,
      axis: `positioning`,
      description: `Shift positioning to autonomous AI eng teams`,
      evidence: [`mrr-up`],
    }
    const Strategy0 = {
      northStar: `north`,
      segments: [],
      positioning: `old`,
      backlog: [],
      activeInitiative: null,
    }

    // Primitive path: openDecision → postPosition ×2 → resolveBoard.
    const h = makeFakeDb()
    seedPrimitiveBoard(h, Strategy0)
    await openPrimitive(h, Proposal)
    const pid = h.rows(`decision_proposals`)[0].id
    await postPrimitive(
      h,
      BoardCtoAgentId,
      pid,
      `endorse`,
      `the shift matches client demand`
    )
    await postPrimitive(h, BoardCeoAgentId, pid, `endorse`, `metrics back this`)
    await resolvePrimitive(h)

    // Hard-coded path: persistDecisions → persistDecisionPositions ×2 → resolveBoard.
    const hc = makeHardcodedDb(Strategy0)
    await openHardcoded(hc, Proposal)
    const hpid = hc.state.proposals[0].id
    await postHardcoded(
      hc,
      ctoSchedule,
      hpid,
      `endorse`,
      `the shift matches client demand`
    )
    await postHardcoded(hc, ceoSchedule, hpid, `endorse`, `metrics back this`)
    await resolveHardcoded(hc)

    const primitive = primitiveEnd(h)
    const hardcoded = hardcodedEnd(hc)
    expectParity(primitive, hardcoded)

    // Anchor the shared end-state absolutely, so parity can never be two paths
    // agreeing on the wrong outcome.
    expect(primitive.proposal).toEqual({
      status: `committed`,
      resolution: `consensus`,
      round: 1,
    })
    expect(primitive.strategy.positioning).toBe(Proposal.description)
    expect(primitive.strategy.updatedByAgentId).toBe(BoardCeoAgentId)
    expect(primitive.strategy.backlog).toEqual([])
  })

  it(`CEO endorse-tiebreak at the round cap (3 full contested rounds) lands the identical end-state on both paths`, async () => {
    const Proposal = {
      title: `Fund a growth experiment`,
      axis: `resource-bet`,
      description: `Divert one cycle per day to growth experiments`,
      evidence: [],
    }
    const Strategy0 = {
      northStar: `north`,
      segments: [],
      positioning: `old`,
      backlog: [],
      activeInitiative: null,
    }

    const h = makeFakeDb()
    seedPrimitiveBoard(h, Strategy0)
    await openPrimitive(h, Proposal)
    const pid = h.rows(`decision_proposals`)[0].id

    const hc = makeHardcodedDb(Strategy0)
    await openHardcoded(hc, Proposal)
    const hpid = hc.state.proposals[0].id

    // Three contested rounds on BOTH paths: the CTO objects and the CEO
    // endorses every round; rounds 1+2 advance, round 3 is the cap.
    for (const round of [1, 2, 3]) {
      await postPrimitive(
        h,
        BoardCtoAgentId,
        pid,
        `object`,
        `still too costly (round ${round})`
      )
      await postPrimitive(h, BoardCeoAgentId, pid, `endorse`, `growth is the bottleneck`)
      await resolvePrimitive(h)

      await postHardcoded(
        hc,
        ctoSchedule,
        hpid,
        `object`,
        `still too costly (round ${round})`
      )
      await postHardcoded(hc, ceoSchedule, hpid, `endorse`, `growth is the bottleneck`)
      await resolveHardcoded(hc)

      // Round-advance parity after each contested resolution under the cap.
      const primitiveProposal = h.rows(`decision_proposals`)[0].data
      const hardcodedProposal = hc.state.proposals[0]
      expect(primitiveProposal.round).toBe(hardcodedProposal.round)
      expect(primitiveProposal.status).toBe(hardcodedProposal.status)
      if (round < 3) {
        expect(primitiveProposal.round).toBe(round + 1)
        expect(primitiveProposal.status).toBe(`deliberating`)
      }
    }

    const primitive = primitiveEnd(h)
    const hardcoded = hardcodedEnd(hc)
    expectParity(primitive, hardcoded)

    // The CEO's latest endorse breaks the tie; the resolution carries its
    // reasoning byte-equal, and the other-axis commit effect appended the
    // proposal to the backlog at priority 1 on both paths.
    expect(primitive.proposal).toEqual({
      status: `tiebroken`,
      resolution: `ceo-tiebreak: growth is the bottleneck`,
      round: 3,
    })
    expect(primitive.strategy.backlog).toEqual([
      { title: Proposal.title, rationale: Proposal.description, priority: 1 },
    ])
    expect(primitive.strategy.positioning).toBe(`old`)
  })

  it(`CEO object-reject at the round cap lands the identical end-state (and touches no strategy) on both paths`, async () => {
    const SeededProposal = {
      title: `Reposition to AI teams`,
      axis: `positioning`,
      description: `Shift positioning to autonomous AI eng teams`,
      evidence: [],
      status: `deliberating`,
      round: 3,
      openedByAgentId: BoardCeoAgentId,
    }
    const Strategy0 = {
      northStar: `north`,
      segments: [],
      positioning: `old`,
      backlog: [],
      activeInitiative: null,
    }

    // Both paths start from the same at-the-cap fixture (the
    // resolveBoard.test.ts fixture style), then post round-3 positions through
    // the real write paths and resolve.
    const h = makeFakeDb()
    seedPrimitiveBoard(h, Strategy0)
    h.seed(`decision_proposals`, `dp_cap`, { ...SeededProposal })
    await postPrimitive(h, BoardCtoAgentId, `dp_cap`, `endorse`, `worth the bet`)
    await postPrimitive(
      h,
      BoardCeoAgentId,
      `dp_cap`,
      `object`,
      `the risk outweighs the upside`
    )
    await resolvePrimitive(h)

    const hc = makeHardcodedDb(Strategy0)
    hc.state.proposals.push({ id: `dp_cap`, orgId: OrgId, ...SeededProposal })
    await postHardcoded(hc, ctoSchedule, `dp_cap`, `endorse`, `worth the bet`)
    await postHardcoded(
      hc,
      ceoSchedule,
      `dp_cap`,
      `object`,
      `the risk outweighs the upside`
    )
    await resolveHardcoded(hc)

    const primitive = primitiveEnd(h)
    const hardcoded = hardcodedEnd(hc)
    expectParity(primitive, hardcoded)

    expect(primitive.proposal).toEqual({
      status: `rejected`,
      resolution: `ceo-tiebreak-reject`,
      round: 3,
    })
    // A rejected proposal never touches the strategy on either path.
    expect(primitive.strategy).toEqual(Strategy0)
    expect(hardcoded.strategy).toEqual(Strategy0)
  })

  it(`completion-gate block rides the consensus resolution byte-equal (frozen initiative untouched) on both paths`, async () => {
    const Proposal = {
      title: `Pivot the loop`,
      axis: `active-initiative`,
      description: `chase a shinier plan`,
      evidence: [],
    }
    const InFlight = {
      title: `In-flight`,
      definitionOfDone: `dod`,
      evidence: [],
      status: `active`,
      committedAt: `2026-07-07T00:00:00Z`,
    }
    const Strategy0 = {
      northStar: `north`,
      segments: [],
      positioning: `x`,
      backlog: [],
      activeInitiative: InFlight,
    }

    const h = makeFakeDb()
    seedPrimitiveBoard(h, Strategy0)
    await openPrimitive(h, Proposal)
    const pid = h.rows(`decision_proposals`)[0].id
    await postPrimitive(h, BoardCtoAgentId, pid, `endorse`, `agreed`)
    await postPrimitive(h, BoardCeoAgentId, pid, `endorse`, `agreed`)
    await resolvePrimitive(h)

    const hc = makeHardcodedDb(Strategy0)
    await openHardcoded(hc, Proposal)
    const hpid = hc.state.proposals[0].id
    await postHardcoded(hc, ctoSchedule, hpid, `endorse`, `agreed`)
    await postHardcoded(hc, ceoSchedule, hpid, `endorse`, `agreed`)
    await resolveHardcoded(hc)

    const primitive = primitiveEnd(h)
    const hardcoded = hardcodedEnd(hc)
    expectParity(primitive, hardcoded)

    // Unanimous endorsement commits the proposal, but the completion gate
    // refuses to swap the in-flight Active Initiative — the blocked note rides
    // the resolution byte-equal on both paths, and neither touched the strategy.
    expect(primitive.proposal).toEqual({
      status: `committed`,
      resolution: `consensus; blocked: active initiative in flight`,
      round: 1,
    })
    expect(primitive.strategy).toEqual(Strategy0)
    expect(hardcoded.strategy).toEqual(Strategy0)
  })
})
