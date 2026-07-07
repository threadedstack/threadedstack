import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EInitiativeStatus, StrategyBlockFence, DecisionsBlockFence } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the helper functions never pulls in the heavy agent runtime.
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

import { strategyOptsIn, buildStrategySection, CompanyStrategyMarker } from './executor'

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

const strategyRow = () => ({
  data: {
    northStar: `Own the AI dev loop`,
    segments: [`indie devs`],
    positioning: `nervous system between models and APIs`,
    activeInitiative: {
      title: `Ship the exec layer`,
      definitionOfDone: `CEO+CTO board live in prod`,
      evidence: [],
      status: EInitiativeStatus.active,
      committedAt: `2026-07-07T00:00:00Z`,
    },
    backlog: [{ title: `Revenue dashboard`, rationale: `see MRR`, priority: 1 }],
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`strategyOptsIn`, () => {
  it(`is true when the prompt emits a tdsk-strategy block`, () => {
    expect(
      strategyOptsIn(schedule({ prompt: `emit a ${StrategyBlockFence} block` }))
    ).toBe(true)
  })

  it(`is true when the prompt emits a tdsk-decisions block`, () => {
    expect(
      strategyOptsIn(schedule({ prompt: `open a ${DecisionsBlockFence} proposal` }))
    ).toBe(true)
  })

  it(`is true when the prompt carries the company-strategy marker`, () => {
    expect(
      strategyOptsIn(schedule({ prompt: `CEO cycle ${CompanyStrategyMarker} directive` }))
    ).toBe(true)
  })

  it(`is false for a steward work cycle (no board fence, no marker)`, () => {
    expect(
      strategyOptsIn(
        schedule({ prompt: `pick a scanned task and open a PR (tdsk-task-picked)` })
      )
    ).toBe(false)
  })

  it(`is false when the schedule has no prompt`, () => {
    expect(strategyOptsIn(schedule({ prompt: undefined }))).toBe(false)
  })
})

describe(`buildStrategySection (assembled cycle context)`, () => {
  it(`INCLUDES the ## Company Strategy section when the cycle opts in and a strategy row exists`, async () => {
    const getByOrg = vi.fn().mockResolvedValue(strategyRow())
    const out = await buildStrategySection(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule({ prompt: `CEO strategy cycle — emit ${StrategyBlockFence}` })
    )

    expect(getByOrg).toHaveBeenCalledWith(`org-1`)
    expect(out).toContain(`## Company Strategy`)
    expect(out).toContain(`Ship the exec layer`)
    expect(out).toContain(`Revenue dashboard`)
  })

  it(`INCLUDES the section for a board cycle opting in via ${DecisionsBlockFence}`, async () => {
    const getByOrg = vi.fn().mockResolvedValue(strategyRow())
    const out = await buildStrategySection(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule({ prompt: `board cycle — post ${DecisionsBlockFence}` })
    )
    expect(out).toContain(`## Company Strategy`)
  })

  it(`EXCLUDES the section for a non-opted-in steward cycle and never queries the DB`, async () => {
    const getByOrg = vi.fn()
    const out = await buildStrategySection(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule({ prompt: `steward work cycle — emit tdsk-task-picked` })
    )
    expect(out).toBe(``)
    expect(getByOrg).not.toHaveBeenCalled()
  })

  it(`EXCLUDES the section when the cycle opts in but no strategy row exists`, async () => {
    const getByOrg = vi.fn().mockResolvedValue({})
    const out = await buildStrategySection(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule({ prompt: `CEO strategy cycle — emit ${StrategyBlockFence}` })
    )
    expect(getByOrg).toHaveBeenCalledWith(`org-1`)
    expect(out).toBe(``)
  })
})
