import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  StrategyBlockFence,
  DecisionsBlockFence,
  DecisionPositionsBlockFence,
  InitiativeCompleteBlockFence,
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

// Spy the metrics builder so we can PROVE it is (not) called per cycle type —
// the gate must never even query the DB for a non-exec (steward/adversary) cycle.
const { metricsBuilder } = vi.hoisted(() => ({ metricsBuilder: vi.fn() }))
vi.mock(`@TBE/utils/agent/businessMetrics`, () => ({
  buildBusinessMetricsContext: metricsBuilder,
}))

import {
  businessMetricsOptsIn,
  buildBusinessMetricsSection,
  CompanyStrategyMarker,
} from './executor'

const buildApp = () => ({ locals: { db: { services: {} } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`businessMetricsOptsIn`, () => {
  it(`is true when the cycle writes a tdsk-strategy block (CEO strategy)`, () => {
    expect(
      businessMetricsOptsIn(schedule({ prompt: `emit a ${StrategyBlockFence} block` }))
    ).toBe(true)
  })

  it(`is true when the cycle opens a tdsk-decisions proposal`, () => {
    expect(
      businessMetricsOptsIn(
        schedule({ prompt: `open a ${DecisionsBlockFence} proposal` })
      )
    ).toBe(true)
  })

  it(`is true for a CTO board cycle posting a tdsk-decision-positions block`, () => {
    expect(
      businessMetricsOptsIn(
        schedule({ prompt: `post your ${DecisionPositionsBlockFence} stance` })
      )
    ).toBe(true)
  })

  it(`is true for a CTO completion cycle emitting tdsk-initiative-complete`, () => {
    expect(
      businessMetricsOptsIn(
        schedule({ prompt: `report via ${InitiativeCompleteBlockFence}` })
      )
    ).toBe(true)
  })

  it(`is true when the prompt carries the company-strategy marker`, () => {
    expect(
      businessMetricsOptsIn(
        schedule({ prompt: `CEO cycle ${CompanyStrategyMarker} directive` })
      )
    ).toBe(true)
  })

  it(`is false for a steward work cycle (no executive fence, no marker)`, () => {
    expect(
      businessMetricsOptsIn(
        schedule({ prompt: `pick a scanned task and open a PR (tdsk-task-picked)` })
      )
    ).toBe(false)
  })

  it(`is false for the adversary review cycle`, () => {
    expect(
      businessMetricsOptsIn(schedule({ prompt: `review PRs and emit tdsk-ops-reviews` }))
    ).toBe(false)
  })

  it(`is false when the schedule has no prompt`, () => {
    expect(businessMetricsOptsIn(schedule({ prompt: undefined }))).toBe(false)
  })
})

describe(`buildBusinessMetricsSection (assembled cycle context)`, () => {
  it(`INCLUDES the ## Business metrics section for an exec cycle and queries with the org id`, async () => {
    metricsBuilder.mockResolvedValue(
      `## Business metrics\nActive subscriptions: 3 total\nEstimated MRR: $305/mo\n\n`
    )

    const out = await buildBusinessMetricsSection(
      buildApp(),
      schedule({ prompt: `CEO strategy cycle — emit ${StrategyBlockFence}` })
    )

    expect(metricsBuilder).toHaveBeenCalledWith(expect.anything(), `org-1`)
    expect(out).toContain(`## Business metrics`)
    expect(out).toContain(`Estimated MRR: $305/mo`)
  })

  it(`INCLUDES the section for a CTO board cycle opting in via ${DecisionPositionsBlockFence}`, async () => {
    metricsBuilder.mockResolvedValue(
      `## Business metrics\nActive subscriptions: 0 total\n\n`
    )
    const out = await buildBusinessMetricsSection(
      buildApp(),
      schedule({ prompt: `board cycle — post ${DecisionPositionsBlockFence}` })
    )
    expect(metricsBuilder).toHaveBeenCalledWith(expect.anything(), `org-1`)
    expect(out).toContain(`## Business metrics`)
  })

  it(`EXCLUDES the section for a non-opted-in steward cycle and NEVER calls the metrics builder`, async () => {
    const out = await buildBusinessMetricsSection(
      buildApp(),
      schedule({ prompt: `steward work cycle — emit tdsk-task-picked` })
    )
    expect(out).toBe(``)
    expect(metricsBuilder).not.toHaveBeenCalled()
  })
})
