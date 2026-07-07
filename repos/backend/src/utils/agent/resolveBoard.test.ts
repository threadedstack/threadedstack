import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EStance, EDecisionAxis, EDecisionStatus, EInitiativeStatus } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Board membership is injected here so resolution is testable before the CEO
// agent is seeded (Phase 6). ag_ceo is first among equals (the tiebreaker).
const boardState = vi.hoisted(() => ({
  members: [
    { agentId: `ag_ceo`, role: `ceo`, isCEO: true },
    { agentId: `ag_cto`, role: `cto`, isCEO: false },
  ] as Array<{ agentId: string; role: string; isCEO: boolean }>,
}))

vi.mock(`@TBE/constants/board`, () => ({
  BoardMaxRounds: 3,
  BoardBlockedActiveInitiativeNote: `blocked: active initiative in flight`,
  StopTheLinePrefix: `STOP-THE-LINE:`,
  StopTheLineEvidenceFlag: `stop-the-line`,
  BoardAbortNotEndorsedNote: `blocked: stop-the-line abort lacks full non-CEO endorsement`,
  BoardAbortNoWindDownNote: `blocked: stop-the-line abort has no wind-down plan`,
  getBoardMembers: () => boardState.members,
  isCeoSchedule: (s: any) => {
    const ceo = boardState.members.find((m) => m.isCEO)
    return !!ceo && s.agentId === ceo.agentId
  },
  isBoardMemberSchedule: (s: any) =>
    boardState.members.some((m) => m.agentId === s.agentId),
}))

import { resolveBoard } from './resolveBoard'

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({
    id: `sd_ceo`,
    orgId: `org-1`,
    agentId: `ag_ceo`,
    prompt: `board cycle`,
    ...overrides,
  }) as any

const proposal = (overrides: Record<string, unknown> = {}) => ({
  id: `dp_1`,
  orgId: `org-1`,
  openedByAgentId: `ag_ceo`,
  title: `Reposition to AI teams`,
  axis: EDecisionAxis.positioning,
  description: `Shift positioning to autonomous AI eng teams`,
  evidence: [],
  status: EDecisionStatus.deliberating,
  round: 1,
  ...overrides,
})

const position = (
  agentId: string,
  stance: EStance,
  round: number,
  reasoning = `because`
) => ({
  agentId,
  stance,
  reasoning,
  round,
})

const buildDb = (opts: { proposals?: any[]; positions?: any[]; strategy?: any }) => {
  const update = vi.fn().mockResolvedValue({ data: {} })
  const advanceRound = vi.fn().mockResolvedValue({ data: {} })
  const listOpenByOrg = vi.fn().mockResolvedValue({ data: opts.proposals ?? [] })
  const latestByProposal = vi.fn().mockResolvedValue({ data: opts.positions ?? [] })
  const getByOrg = vi
    .fn()
    .mockResolvedValue(opts.strategy !== undefined ? { data: opts.strategy } : {})
  const setActiveInitiative = vi.fn().mockResolvedValue({ data: {} })
  const upsertByOrg = vi.fn().mockResolvedValue({ data: {} })
  const promoteNextFromBacklog = vi.fn().mockResolvedValue({ data: {} })
  const clearActiveInitiative = vi.fn().mockResolvedValue({ data: {} })
  const db = {
    services: {
      decisionProposal: { listOpenByOrg, update, advanceRound },
      decisionPosition: { latestByProposal },
      companyStrategy: {
        getByOrg,
        setActiveInitiative,
        upsertByOrg,
        promoteNextFromBacklog,
        clearActiveInitiative,
      },
    },
  }
  return {
    app: { locals: { db } } as any,
    spies: {
      update,
      advanceRound,
      listOpenByOrg,
      latestByProposal,
      getByOrg,
      setActiveInitiative,
      upsertByOrg,
      promoteNextFromBacklog,
      clearActiveInitiative,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  boardState.members = [
    { agentId: `ag_ceo`, role: `ceo`, isCEO: true },
    { agentId: `ag_cto`, role: `cto`, isCEO: false },
  ]
})

describe(`resolveBoard — consensus commit`, () => {
  it(`commits a proposal when every member endorses the current round, and runs the commit effect`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 1 })],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: { positioning: `old`, backlog: [], activeInitiative: null },
    })

    await resolveBoard(app, schedule())

    expect(spies.update).toHaveBeenCalledTimes(1)
    expect(spies.update.mock.calls[0][0]).toMatchObject({
      id: `dp_1`,
      status: EDecisionStatus.committed,
      resolution: `consensus`,
    })
    // commit effect for a positioning proposal writes the strategy positioning
    expect(spies.upsertByOrg).toHaveBeenCalledWith(
      `org-1`,
      expect.objectContaining({
        positioning: `Shift positioning to autonomous AI eng teams`,
      })
    )
    expect(spies.advanceRound).not.toHaveBeenCalled()
  })
})

describe(`resolveBoard — re-deliberate`, () => {
  it(`advances the round when a member objects under the round cap (object → next round)`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 1 })],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.object, 1),
      ],
    })

    await resolveBoard(app, schedule())

    expect(spies.advanceRound).toHaveBeenCalledWith(`dp_1`)
    expect(spies.update).not.toHaveBeenCalled()
    expect(spies.upsertByOrg).not.toHaveBeenCalled()
  })

  it(`commits once the members re-endorse at the advanced round`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 2 })],
      positions: [
        position(`ag_ceo`, EStance.endorse, 2),
        position(`ag_cto`, EStance.endorse, 2),
      ],
      strategy: { positioning: `old`, backlog: [], activeInitiative: null },
    })

    await resolveBoard(app, schedule())

    expect(spies.advanceRound).not.toHaveBeenCalled()
    expect(spies.update.mock.calls[0][0]).toMatchObject({
      status: EDecisionStatus.committed,
      resolution: `consensus`,
    })
  })
})

describe(`resolveBoard — CEO tiebreak`, () => {
  it(`tiebreaks + commits when disagreement persists to the round cap and the CEO endorses`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 3 })],
      positions: [
        position(`ag_ceo`, EStance.endorse, 3, `metrics back this`),
        position(`ag_cto`, EStance.object, 3),
      ],
      strategy: { positioning: `old`, backlog: [], activeInitiative: null },
    })

    await resolveBoard(app, schedule())

    expect(spies.advanceRound).not.toHaveBeenCalled()
    const call = spies.update.mock.calls[0][0]
    expect(call.status).toBe(EDecisionStatus.tiebroken)
    expect(call.resolution).toContain(`ceo-tiebreak:`)
    expect(call.resolution).toContain(`metrics back this`)
    // tiebreak still runs the commit effect
    expect(spies.upsertByOrg).toHaveBeenCalled()
  })

  it(`resolves a 2-member deadlock at the cap via the CEO's decisive endorse`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 3, axis: EDecisionAxis.resourceBet })],
      positions: [
        position(`ag_ceo`, EStance.endorse, 3),
        position(`ag_cto`, EStance.amend, 3),
      ],
      strategy: { positioning: `x`, backlog: [], activeInitiative: null },
    })

    await resolveBoard(app, schedule())

    expect(spies.update.mock.calls[0][0].status).toBe(EDecisionStatus.tiebroken)
  })

  it(`rejects when the round cap is hit and the CEO objects (no commit effect)`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 3 })],
      positions: [
        position(`ag_ceo`, EStance.object, 3),
        position(`ag_cto`, EStance.endorse, 3),
      ],
      strategy: { positioning: `old`, backlog: [], activeInitiative: null },
    })

    await resolveBoard(app, schedule())

    expect(spies.update).toHaveBeenCalledTimes(1)
    expect(spies.update.mock.calls[0][0]).toMatchObject({
      status: EDecisionStatus.rejected,
      resolution: `ceo-tiebreak-reject`,
    })
    // a rejected proposal never touches the strategy
    expect(spies.upsertByOrg).not.toHaveBeenCalled()
    expect(spies.setActiveInitiative).not.toHaveBeenCalled()
  })
})

describe(`resolveBoard — active-initiative commit gate`, () => {
  it(`sets the Active Initiative from a committed active-initiative proposal when none is in flight`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 1,
          title: `Ship billing v2`,
          description: `merged+deployed+verified`,
          evidence: [`ref-1`],
        }),
      ],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: { positioning: `x`, backlog: [], activeInitiative: null },
    })

    await resolveBoard(app, schedule())

    expect(spies.setActiveInitiative).toHaveBeenCalledWith(
      `org-1`,
      expect.objectContaining({
        title: `Ship billing v2`,
        definitionOfDone: `merged+deployed+verified`,
        evidence: [`ref-1`],
        status: EInitiativeStatus.active,
      })
    )
    expect(spies.update.mock.calls[0][0].status).toBe(EDecisionStatus.committed)
  })

  // CORE STABILITY GUARANTEE: re-direction blocked until initiative-complete.
  it(`re-direction blocked until initiative-complete — a committed active-initiative swap is refused while one is active`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 1,
          title: `Pivot the loop`,
          description: `chase a shinier plan`,
        }),
      ],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: {
        positioning: `x`,
        backlog: [],
        activeInitiative: { title: `In-flight`, status: EInitiativeStatus.active },
      },
    })

    await resolveBoard(app, schedule())

    // the frozen Active Initiative is never swapped mid-flight (no completion, no abort)
    expect(spies.setActiveInitiative).not.toHaveBeenCalled()
    expect(spies.promoteNextFromBacklog).not.toHaveBeenCalled()
    expect(spies.clearActiveInitiative).not.toHaveBeenCalled()
    const call = spies.update.mock.calls[0][0]
    expect(call.status).toBe(EDecisionStatus.committed)
    expect(call.resolution).toContain(`blocked: active initiative in flight`)
  })

  it(`allows a new Active Initiative once the prior one is no longer active (status complete)`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 1,
          title: `Next big bet`,
          description: `merged+deployed+verified`,
        }),
      ],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: {
        positioning: `x`,
        backlog: [],
        activeInitiative: { title: `Done thing`, status: EInitiativeStatus.complete },
      },
    })

    await resolveBoard(app, schedule())

    expect(spies.setActiveInitiative).toHaveBeenCalledWith(
      `org-1`,
      expect.objectContaining({ title: `Next big bet`, status: EInitiativeStatus.active })
    )
  })
})

describe(`resolveBoard — stop-the-line abort`, () => {
  const inFlightStrategy = (backlog: any[] = []) => ({
    positioning: `x`,
    backlog,
    activeInitiative: {
      title: `In-flight`,
      definitionOfDone: `dod`,
      evidence: [],
      status: EInitiativeStatus.active,
      committedAt: `2026-07-07T00:00:00Z`,
    },
  })

  it(`stop-the-line abort winds down + promotes next — full non-CEO endorsement + wind-down note succeeds`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 1,
          title: `STOP-THE-LINE: abort the failing initiative`,
          description: `revert the merged PRs to a safe state`,
          evidence: [`error-rate-spiked`],
        }),
      ],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: inFlightStrategy([
        { title: `Recovery work`, rationale: `stabilize`, priority: 1 },
      ]),
    })

    await resolveBoard(app, schedule())

    // the in-flight initiative is marked aborted (wound down), not left dangling
    expect(spies.setActiveInitiative).toHaveBeenCalledWith(
      `org-1`,
      expect.objectContaining({ title: `In-flight`, status: EInitiativeStatus.aborted })
    )
    // then the next backlog bet is promoted (backlog non-empty)
    expect(spies.promoteNextFromBacklog).toHaveBeenCalledWith(`org-1`)
    expect(spies.clearActiveInitiative).not.toHaveBeenCalled()
    const call = spies.update.mock.calls[0][0]
    expect(call.status).toBe(EDecisionStatus.committed)
    expect(call.resolution).toContain(`stop-the-line abort`)
    expect(call.resolution).toContain(`revert the merged PRs to a safe state`)
  })

  it(`clears the Active Initiative on abort when the backlog is empty`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 1,
          title: `Wind it down`,
          description: `finish-to-safe then stop`,
          evidence: [`stop-the-line`],
        }),
      ],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: inFlightStrategy([]),
    })

    await resolveBoard(app, schedule())

    expect(spies.setActiveInitiative).toHaveBeenCalledWith(
      `org-1`,
      expect.objectContaining({ status: EInitiativeStatus.aborted })
    )
    expect(spies.clearActiveInitiative).toHaveBeenCalledWith(`org-1`)
    expect(spies.promoteNextFromBacklog).not.toHaveBeenCalled()
  })

  it(`blocks a stop-the-line abort WITHOUT full non-CEO endorsement (CEO tiebreak cannot abort alone)`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 3,
          title: `STOP-THE-LINE: force an abort`,
          description: `revert everything`,
          evidence: [`stop-the-line`],
        }),
      ],
      // round cap reached; CEO endorses (would tiebreak-commit) but the CTO objects,
      // so the non-CEO high bar is NOT met.
      positions: [
        position(`ag_ceo`, EStance.endorse, 3),
        position(`ag_cto`, EStance.object, 3),
      ],
      strategy: inFlightStrategy([
        { title: `Recovery work`, rationale: `stabilize`, priority: 1 },
      ]),
    })

    await resolveBoard(app, schedule())

    // the abort is refused: the frozen Active Initiative is untouched
    expect(spies.setActiveInitiative).not.toHaveBeenCalled()
    expect(spies.promoteNextFromBacklog).not.toHaveBeenCalled()
    expect(spies.clearActiveInitiative).not.toHaveBeenCalled()
    const call = spies.update.mock.calls[0][0]
    expect(call.status).toBe(EDecisionStatus.tiebroken)
    expect(call.resolution).toContain(
      `blocked: stop-the-line abort lacks full non-CEO endorsement`
    )
  })

  it(`blocks a stop-the-line abort with no wind-down plan (empty description)`, async () => {
    const { app, spies } = buildDb({
      proposals: [
        proposal({
          axis: EDecisionAxis.activeInitiative,
          round: 1,
          title: `STOP-THE-LINE: abort`,
          description: ``,
          evidence: [`stop-the-line`],
        }),
      ],
      positions: [
        position(`ag_ceo`, EStance.endorse, 1),
        position(`ag_cto`, EStance.endorse, 1),
      ],
      strategy: inFlightStrategy([]),
    })

    await resolveBoard(app, schedule())

    expect(spies.setActiveInitiative).not.toHaveBeenCalled()
    expect(spies.clearActiveInitiative).not.toHaveBeenCalled()
    const call = spies.update.mock.calls[0][0]
    expect(call.resolution).toContain(
      `blocked: stop-the-line abort has no wind-down plan`
    )
  })
})

describe(`resolveBoard — waiting`, () => {
  it(`does nothing when a member has not yet positioned at the current round`, async () => {
    const { app, spies } = buildDb({
      proposals: [proposal({ round: 1 })],
      positions: [position(`ag_ceo`, EStance.endorse, 1)],
    })

    await resolveBoard(app, schedule())

    expect(spies.update).not.toHaveBeenCalled()
    expect(spies.advanceRound).not.toHaveBeenCalled()
  })

  it(`returns early with no open proposals`, async () => {
    const { app, spies } = buildDb({ proposals: [] })
    await resolveBoard(app, schedule())
    expect(spies.latestByProposal).not.toHaveBeenCalled()
    expect(spies.update).not.toHaveBeenCalled()
  })
})
