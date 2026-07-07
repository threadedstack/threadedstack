import { describe, it, expect, vi } from 'vitest'

import { AgentScheduleDefs } from '@TDB/seeds/agentSchedules'
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
  prompt: `hello world this prompt is long enough`,
  ...over,
})

describe(`AgentScheduleDefs`, () => {
  it(`defines all 14 operating schedules (11 self-development + 3 executive-board) with unique ids and real prompts`, () => {
    expect(AgentScheduleDefs).toHaveLength(14)
    const ids = AgentScheduleDefs.map((d) => d.id)
    expect(new Set(ids).size).toBe(14)
    for (const d of AgentScheduleDefs) {
      expect(d.prompt.length).toBeGreaterThan(50)
      expect(d.type).toBe(`prompt`)
      expect(d.orgId).toBe(`og_0000001`)
      expect(d.projectId).toBe(`pj_tIly2F1`)
      expect(d.cronExpression).toMatch(/[\d*]/)
    }
  })

  it(`ships the executive-board schedules disabled and inert until activation`, () => {
    const execKeys = [`ceo-strategy`, `ceo-board`, `cto-board`]
    const byKey = Object.fromEntries(AgentScheduleDefs.map((d) => [d.key, d]))
    for (const key of execKeys) {
      expect(byKey[key]).toBeDefined()
      expect(byKey[key].enabled).toBe(false)
    }
    // The CEO seat runs on the seeded founder agent; the CTO seat reuses the steward.
    expect(byKey[`ceo-strategy`].agentId).toBe(`ag_ceo0001`)
    expect(byKey[`ceo-board`].agentId).toBe(`ag_ceo0001`)
    expect(byKey[`cto-board`].agentId).toBe(`ag_lvUbjp_`)
    // Every self-development schedule stays enabled.
    for (const d of AgentScheduleDefs) {
      if (!execKeys.includes(d.key)) expect(d.enabled).toBe(true)
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
