import { describe, it, expect, vi } from 'vitest'

import type { EScheduleType } from '@tdsk/domain'

import {
  ScheduleBridge,
  buildScheduleBridges,
  createScheduleCapability,
} from './scheduleCapability'

const makeDb = (
  overrides: {
    project?: any
    agent?: any
    schedule?: any
    createResult?: any
    createError?: any
  } = {}
) => {
  const project = overrides.project ?? { id: `p1`, orgId: `org1` }
  const agent = overrides.agent ?? null
  const schedule = overrides.schedule ?? null
  const created =
    overrides.createResult ??
    (({ id: _ignored, ...rest }: any) => ({
      id: `sch_new1`,
      ...rest,
    }))

  return {
    services: {
      project: { get: vi.fn(async () => ({ data: project })) },
      agent: { get: vi.fn(async () => ({ data: agent })) },
      schedule: {
        get: vi.fn(async () => ({ data: schedule })),
        create: vi.fn(async (s: any) =>
          overrides.createError
            ? { error: overrides.createError }
            : { data: typeof created === `function` ? created(s) : created }
        ),
      },
    },
  }
}

describe(`scheduleCapability`, () => {
  it(`AGENT caller: binds sandboxId from the agent's own environment.sandboxId (never isolate-supplied)`, async () => {
    const db = makeDb({
      agent: { id: `ag1`, environment: { sandboxId: `sbx_agent1` } },
    }) as any
    const cap = createScheduleCapability(db, `p1`, { agentId: `ag1` })

    const res = await cap.create({ cronExpression: `0 9 * * *`, prompt: `do the thing` })

    expect(res).toEqual({
      id: `sch_new1`,
      cronExpression: `0 9 * * *`,
      nextRunAt: expect.any(String),
    })
    const inserted = db.services.schedule.create.mock.calls[0][0]
    expect(inserted.projectId).toBe(`p1`)
    expect(inserted.orgId).toBe(`org1`)
    expect(inserted.sandboxId).toBe(`sbx_agent1`)
    expect(inserted.agentId).toBe(`ag1`)
  })

  it(`SCHEDULE caller: reuses the invoking schedule's OWN sandboxId`, async () => {
    const db = makeDb({
      schedule: { id: `sch_current`, projectId: `p1`, sandboxId: `sbx_sched1` },
    }) as any
    const cap = createScheduleCapability(db, `p1`, { scheduleId: `sch_current` })

    const res = await cap.create({ cronExpression: `*/5 * * * *` })

    expect(res.id).toBe(`sch_new1`)
    const inserted = db.services.schedule.create.mock.calls[0][0]
    expect(inserted.sandboxId).toBe(`sbx_sched1`)
    expect(inserted.projectId).toBe(`p1`)
    // no agentId caller ⇒ the new schedule is not agent-owned
    expect(inserted.agentId).toBeUndefined()
  })

  it(`refuses (fail-closed) when no sandbox can be resolved from the caller`, async () => {
    const db = makeDb({ agent: { id: `ag1`, environment: {} } }) as any
    const cap = createScheduleCapability(db, `p1`, { agentId: `ag1` })

    await expect(cap.create({ cronExpression: `0 9 * * *` })).rejects.toThrow(
      /no sandbox could be resolved/
    )
    expect(db.services.schedule.create).not.toHaveBeenCalled()
  })

  it(`refuses a schedule caller whose OWN schedule belongs to a different project`, async () => {
    const db = makeDb({
      schedule: { id: `sch_current`, projectId: `OTHER`, sandboxId: `sbx_sched1` },
    }) as any
    const cap = createScheduleCapability(db, `p1`, { scheduleId: `sch_current` })

    await expect(cap.create({ cronExpression: `0 9 * * *` })).rejects.toThrow(
      /no sandbox could be resolved/
    )
  })

  it(`throws on an invalid cron expression`, async () => {
    const db = makeDb({ agent: { environment: { sandboxId: `sbx1` } } }) as any
    const cap = createScheduleCapability(db, `p1`, { agentId: `ag1` })

    await expect(cap.create({ cronExpression: `not-a-cron` })).rejects.toThrow(
      /invalid cron expression/
    )
    expect(db.services.schedule.create).not.toHaveBeenCalled()
  })

  it(`throws on an out-of-bounds timeoutMs`, async () => {
    const db = makeDb({ agent: { environment: { sandboxId: `sbx1` } } }) as any
    const cap = createScheduleCapability(db, `p1`, { agentId: `ag1` })

    await expect(
      cap.create({ cronExpression: `0 9 * * *`, timeoutMs: 1 })
    ).rejects.toThrow(/timeoutMs must be/)
  })

  it(`throws on an invalid schedule type`, async () => {
    const db = makeDb({ agent: { environment: { sandboxId: `sbx1` } } }) as any
    const cap = createScheduleCapability(db, `p1`, { agentId: `ag1` })

    await expect(
      cap.create({ cronExpression: `0 9 * * *`, type: `bogus` as EScheduleType })
    ).rejects.toThrow(/invalid schedule type/)
  })

  it(`surfaces a db create error as a handler-level failure`, async () => {
    const db = makeDb({
      agent: { environment: { sandboxId: `sbx1` } },
      createError: new Error(`db unavailable`),
    }) as any
    const cap = createScheduleCapability(db, `p1`, { agentId: `ag1` })

    await expect(cap.create({ cronExpression: `0 9 * * *` })).rejects.toThrow(
      /db unavailable/
    )
  })

  it(`buildScheduleBridges is fail-closed: no agentId AND no scheduleId → no bridge`, () => {
    const db = makeDb() as any
    expect(buildScheduleBridges(db, `p1`)).toEqual({})
    expect(buildScheduleBridges(db, `p1`, {})).toEqual({})
    expect(Object.keys(buildScheduleBridges(db, `p1`, { agentId: `ag1` }))).toContain(
      ScheduleBridge.create
    )
    expect(Object.keys(buildScheduleBridges(db, `p1`, { scheduleId: `sch1` }))).toContain(
      ScheduleBridge.create
    )
  })

  it(`the JSON bridge marshals input through to create() and returns the JSON result`, async () => {
    const db = makeDb({ agent: { environment: { sandboxId: `sbx1` } } }) as any
    const bridges = buildScheduleBridges(db, `p1`, { agentId: `ag1` })

    const resultJson = await bridges[ScheduleBridge.create](
      JSON.stringify([{ cronExpression: `0 9 * * *`, prompt: `hi` }])
    )
    const result = JSON.parse(resultJson)
    expect(result).toEqual({
      id: `sch_new1`,
      cronExpression: `0 9 * * *`,
      nextRunAt: expect.any(String),
    })
  })
})
