import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EInitiativeStatus } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { buildCompanyStrategyContext } from './companyStrategy'

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`buildCompanyStrategyContext`, () => {
  it(`renders north star, segments, positioning, the active initiative, and backlog`, async () => {
    const getByOrg = vi.fn().mockResolvedValue({
      data: {
        northStar: `Own the AI dev loop`,
        segments: [`indie devs`, `AI startups`],
        positioning: `The nervous system between models and APIs`,
        activeInitiative: {
          title: `Ship the exec layer`,
          definitionOfDone: `CEO+CTO board live in prod`,
          evidence: [],
          status: EInitiativeStatus.active,
          committedAt: `2026-07-07T00:00:00Z`,
        },
        backlog: [
          { title: `Revenue dashboard`, rationale: `see MRR`, priority: 1 },
          { title: `Churn alerts`, rationale: `retention`, priority: 2 },
        ],
      },
    })

    const out = await buildCompanyStrategyContext(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule()
    )

    expect(getByOrg).toHaveBeenCalledWith(`org-1`)
    expect(out).toContain(`## Company Strategy`)
    expect(out).toContain(`North Star: Own the AI dev loop`)
    expect(out).toContain(`Segments: indie devs, AI startups`)
    expect(out).toContain(`Positioning: The nervous system between models and APIs`)
    // Active Initiative renders title + definition-of-done + status
    expect(out).toContain(`Active Initiative: Ship the exec layer`)
    expect(out).toContain(`CEO+CTO board live in prod`)
    expect(out).toContain(`[active]`)
    // Backlog items render title + priority
    expect(out).toContain(`Backlog (top 2):`)
    expect(out).toContain(`- [1] Revenue dashboard`)
    expect(out).toContain(`- [2] Churn alerts`)
  })

  it(`renders the awaiting-next note when there is no active initiative`, async () => {
    const getByOrg = vi.fn().mockResolvedValue({
      data: {
        northStar: `x`,
        segments: [],
        positioning: null,
        activeInitiative: null,
        backlog: [],
      },
    })
    const out = await buildCompanyStrategyContext(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule()
    )
    expect(out).toContain(`## Company Strategy`)
    expect(out).toContain(`Active Initiative: none — awaiting next initiative`)
  })

  it(`returns '' when the org has no strategy row (getByOrg returns {})`, async () => {
    const getByOrg = vi.fn().mockResolvedValue({})
    const out = await buildCompanyStrategyContext(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule()
    )
    expect(out).toBe(``)
  })

  it(`returns '' and never throws when the service rejects`, async () => {
    const getByOrg = vi.fn().mockRejectedValue(new Error(`db down`))
    const out = await buildCompanyStrategyContext(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule()
    )
    expect(out).toBe(``)
  })

  it(`caps the rendered block at StrategyInjectMaxChars`, async () => {
    const getByOrg = vi.fn().mockResolvedValue({
      data: {
        northStar: `n`.repeat(20000),
        segments: [],
        positioning: null,
        activeInitiative: null,
        backlog: [],
      },
    })
    const out = await buildCompanyStrategyContext(
      buildApp({ companyStrategy: { getByOrg } }),
      schedule()
    )
    expect(out.length).toBe(8000)
  })
})
