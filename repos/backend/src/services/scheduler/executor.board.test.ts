import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EDecisionAxis,
  EDecisionStatus,
  StrategyBlockFence,
  DecisionsBlockFence,
  DecisionPositionsBlockFence,
} from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the helper functions never pulls in the heavy agent runtime.
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

// Inject board membership so the persist paths are testable before the CEO agent
// is seeded (Phase 6). ag_ceo = CEO, ag_cto = CTO (a board member), ag_steward =
// a non-board dev-loop agent used to prove the steward/adversary cycles are inert.
const boardState = vi.hoisted(() => ({
  members: [
    { agentId: `ag_ceo`, role: `ceo`, isCEO: true },
    { agentId: `ag_cto`, role: `cto`, isCEO: false },
  ] as Array<{ agentId: string; role: string; isCEO: boolean }>,
}))

vi.mock(`@TBE/constants/board`, () => ({
  BoardMaxRounds: 3,
  BoardBlockedActiveInitiativeNote: `blocked: active initiative in flight`,
  getBoardMembers: () => boardState.members,
  isCeoSchedule: (s: any) => {
    const ceo = boardState.members.find((m) => m.isCEO)
    return !!ceo && s.agentId === ceo.agentId
  },
  isBoardMemberSchedule: (s: any) =>
    boardState.members.some((m) => m.agentId === s.agentId),
}))

import { persistDecisions, persistDecisionPositions, persistStrategy } from './executor'

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({
    id: `sd_1`,
    orgId: `org-1`,
    agentId: `ag_cto`,
    prompt: `board cycle`,
    ...overrides,
  }) as any

const fenced = (fence: string, payload: unknown) =>
  `preamble text\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

beforeEach(() => {
  vi.clearAllMocks()
  boardState.members = [
    { agentId: `ag_ceo`, role: `ceo`, isCEO: true },
    { agentId: `ag_cto`, role: `cto`, isCEO: false },
  ]
})

describe(`persistDecisions`, () => {
  it(`opens a proposal from a decisions block emitted by a board member`, async () => {
    const listOpenByOrg = vi.fn().mockResolvedValue({ data: [] })
    const create = vi.fn().mockResolvedValue({ data: { id: `dp_1` } })
    const stdout = fenced(DecisionsBlockFence, [
      {
        title: `Reposition to AI eng teams`,
        axis: EDecisionAxis.positioning,
        description: `metrics show team demand`,
        evidence: [`mrr-up`],
      },
    ])

    await persistDecisions(
      buildApp({ decisionProposal: { listOpenByOrg, create } }),
      schedule({ agentId: `ag_cto` }),
      stdout
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({
      orgId: `org-1`,
      openedByAgentId: `ag_cto`,
      title: `Reposition to AI eng teams`,
      axis: EDecisionAxis.positioning,
      description: `metrics show team demand`,
      status: EDecisionStatus.open,
      round: 1,
    })
  })

  it(`dedupes against an already-open proposal with the same title`, async () => {
    const listOpenByOrg = vi
      .fn()
      .mockResolvedValue({ data: [{ title: `Reposition to AI eng teams` }] })
    const create = vi.fn()
    const stdout = fenced(DecisionsBlockFence, [
      {
        title: `Reposition to AI eng teams`,
        axis: EDecisionAxis.positioning,
        description: `same one again`,
      },
    ])

    await persistDecisions(
      buildApp({ decisionProposal: { listOpenByOrg, create } }),
      schedule(),
      stdout
    )

    expect(create).not.toHaveBeenCalled()
  })

  it(`persists NOTHING when a non-board (steward) cycle emits a decisions block`, async () => {
    const listOpenByOrg = vi.fn()
    const create = vi.fn()
    const stdout = fenced(DecisionsBlockFence, [
      { title: `x`, axis: EDecisionAxis.pricing, description: `y` },
    ])

    await persistDecisions(
      buildApp({ decisionProposal: { listOpenByOrg, create } }),
      schedule({ agentId: `ag_steward` }),
      stdout
    )

    expect(listOpenByOrg).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})

describe(`persistDecisionPositions`, () => {
  it(`records a stance at the proposal's current round`, async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: `dp_1`,
        orgId: `org-1`,
        status: EDecisionStatus.deliberating,
        round: 2,
      },
    })
    const create = vi.fn().mockResolvedValue({ data: { id: `dpos_1` } })
    const stdout = fenced(DecisionPositionsBlockFence, [
      { proposalId: `dp_1`, stance: `endorse`, reasoning: `agree, ship it` },
    ])

    await persistDecisionPositions(
      buildApp({ decisionProposal: { get }, decisionPosition: { create } }),
      schedule({ agentId: `ag_cto` }),
      stdout
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({
      orgId: `org-1`,
      proposalId: `dp_1`,
      agentId: `ag_cto`,
      stance: `endorse`,
      reasoning: `agree, ship it`,
      round: 2,
    })
  })

  it(`is a no-op for a position on a closed (committed) proposal`, async () => {
    const get = vi.fn().mockResolvedValue({
      data: { id: `dp_1`, orgId: `org-1`, status: EDecisionStatus.committed, round: 1 },
    })
    const create = vi.fn()
    const stdout = fenced(DecisionPositionsBlockFence, [
      { proposalId: `dp_1`, stance: `object`, reasoning: `too late` },
    ])

    await persistDecisionPositions(
      buildApp({ decisionProposal: { get }, decisionPosition: { create } }),
      schedule(),
      stdout
    )

    expect(create).not.toHaveBeenCalled()
  })

  it(`persists NOTHING when a non-board (steward) cycle emits a positions block`, async () => {
    const get = vi.fn()
    const create = vi.fn()
    const stdout = fenced(DecisionPositionsBlockFence, [
      { proposalId: `dp_1`, stance: `endorse`, reasoning: `r` },
    ])

    await persistDecisionPositions(
      buildApp({ decisionProposal: { get }, decisionPosition: { create } }),
      schedule({ agentId: `ag_steward` }),
      stdout
    )

    expect(get).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})

describe(`persistStrategy`, () => {
  it(`applies a CEO strategy block (backlog update) via upsertByOrg`, async () => {
    const upsertByOrg = vi.fn().mockResolvedValue({ data: { id: `cs_1` } })
    const stdout = fenced(StrategyBlockFence, [
      {
        northStar: `Own the AI dev loop`,
        backlog: [{ title: `Revenue dashboard`, rationale: `see MRR`, priority: 1 }],
      },
    ])

    await persistStrategy(
      buildApp({ companyStrategy: { upsertByOrg } }),
      schedule({ agentId: `ag_ceo` }),
      stdout
    )

    expect(upsertByOrg).toHaveBeenCalledTimes(1)
    const [orgId, patch] = upsertByOrg.mock.calls[0]
    expect(orgId).toBe(`org-1`)
    expect(patch).toMatchObject({
      updatedByAgentId: `ag_ceo`,
      northStar: `Own the AI dev loop`,
      backlog: [{ title: `Revenue dashboard`, rationale: `see MRR`, priority: 1 }],
    })
    // the Active Initiative is NEVER written through the strategy block
    expect(patch).not.toHaveProperty(`activeInitiative`)
  })

  it(`ignores a strategy block emitted by a NON-CEO (CTO) cycle`, async () => {
    const upsertByOrg = vi.fn()
    const stdout = fenced(StrategyBlockFence, [{ positioning: `sneaky rewrite` }])

    await persistStrategy(
      buildApp({ companyStrategy: { upsertByOrg } }),
      schedule({ agentId: `ag_cto` }),
      stdout
    )

    expect(upsertByOrg).not.toHaveBeenCalled()
  })
})

describe(`steward/adversary dev-loop cycles are unaffected`, () => {
  it(`persists NOTHING when a steward cycle emits decision + position + strategy blocks`, async () => {
    const listOpenByOrg = vi.fn()
    const proposalCreate = vi.fn()
    const get = vi.fn()
    const positionCreate = vi.fn()
    const upsertByOrg = vi.fn()

    const stdout = [
      fenced(DecisionsBlockFence, [
        { title: `t`, axis: EDecisionAxis.segment, description: `d` },
      ]),
      fenced(DecisionPositionsBlockFence, [
        { proposalId: `dp_x`, stance: `endorse`, reasoning: `r` },
      ]),
      fenced(StrategyBlockFence, [{ northStar: `hijack` }]),
    ].join(`\n\n`)

    const app = buildApp({
      decisionProposal: { listOpenByOrg, create: proposalCreate, get },
      decisionPosition: { create: positionCreate },
      companyStrategy: { upsertByOrg },
    })
    const steward = schedule({ agentId: `ag_steward`, prompt: `steward work cycle` })

    await persistDecisions(app, steward, stdout)
    await persistDecisionPositions(app, steward, stdout)
    await persistStrategy(app, steward, stdout)

    expect(listOpenByOrg).not.toHaveBeenCalled()
    expect(proposalCreate).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(positionCreate).not.toHaveBeenCalled()
    expect(upsertByOrg).not.toHaveBeenCalled()
  })
})
