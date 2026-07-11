import { ScheduleRun } from './scheduleRun'
import { ScheduleRun as ScheduleRunModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger to avoid config/db initialization side-effects — its module
// load imports db.config, which throws in the env-less deploy test step (see
// apiKey.test.ts for the established pattern).
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

/**
 * Mock Drizzle DB covering the three chains scheduleRun.ts drives directly:
 * update().set().where().returning(), select().from().where()(.limit()), and
 * insert().values().onConflictDoNothing().returning().
 */
const createMockDb = () => {
  const updateReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const updateWhereFn = vi.fn((..._args: any[]) => ({ returning: updateReturningFn }))
  const updateSetFn = vi.fn((..._args: any[]) => ({ where: updateWhereFn }))
  const updateFn = vi.fn((..._args: any[]) => ({ set: updateSetFn }))

  const selectLimitFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const selectWhereFn = vi.fn((..._args: any[]) => {
    const res: any = Promise.resolve([])
    res.limit = selectLimitFn
    return res
  })
  const selectFromFn = vi.fn((..._args: any[]) => ({ where: selectWhereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: selectFromFn }))

  const insertReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const insertOnConflictDoNothingFn = vi.fn((..._args: any[]) => ({
    returning: insertReturningFn,
  }))
  const insertValuesFn = vi.fn((..._args: any[]) => ({
    onConflictDoNothing: insertOnConflictDoNothingFn,
  }))
  const insertFn = vi.fn((..._args: any[]) => ({ values: insertValuesFn }))

  return {
    db: { update: updateFn, select: selectFn, insert: insertFn } as any,
    updateFn,
    updateSetFn,
    updateWhereFn,
    updateReturningFn,
    selectFn,
    selectFromFn,
    selectWhereFn,
    selectLimitFn,
    insertFn,
    insertValuesFn,
    insertOnConflictDoNothingFn,
    insertReturningFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `sr_run00001`,
  orgId: `og_org00001`,
  projectId: `pj_proj0001`,
  scheduleId: `sc_sched001`,
  status: `running`,
  instanceId: null,
  error: null,
  stdoutKey: null,
  stderrKey: null,
  durationMs: null,
  startedAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`ScheduleRun service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: ScheduleRun

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new ScheduleRun({ db: mocks.db, config: {} } as any)
  })

  describe(`setInstance`, () => {
    it(`persists the pod name and returns the row id`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([{ id: `sr_run00001` }])

      const { data, error } = await service.setInstance(`sr_run00001`, `pod-abc123`)

      expect(error).toBeUndefined()
      expect(data).toEqual({ id: `sr_run00001` })
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: `pod-abc123` })
      )
    })

    it(`returns { error } when the run does not exist`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.setInstance(`sr_missing01`, `pod-abc123`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`Schedule run not found`)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.setInstance(`sr_run00001`, `pod-abc123`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`complete`, () => {
    it(`writes the final status and models the updated row`, async () => {
      const row = fakeRow({ status: `success`, completedAt: new Date() })
      mocks.updateReturningFn.mockResolvedValueOnce([row])

      const { data, error } = await service.complete(`sr_run00001`, {
        status: `success`,
        durationMs: 1200,
      })

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(ScheduleRunModel)
      expect(data?.status).toBe(`success`)
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: `success`, durationMs: 1200 })
      )
    })

    it(`returns { error } when the run does not exist`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.complete(`sr_missing01`, {
        status: `error`,
      })

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`Schedule run not found`)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`connection lost`))

      const { data, error } = await service.complete(`sr_run00001`, {
        status: `timeout`,
      })

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`connection lost`)
    })
  })

  describe(`claimRunning`, () => {
    const claimArgs = {
      orgId: `og_org00001`,
      scheduleId: `sc_sched001`,
      projectId: `pj_proj0001`,
      startedAt: new Date(`2026-07-11T16:00:00Z`),
    }

    it(`inserts and returns the modeled row when the claim succeeds`, async () => {
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow()])

      const { data, error, conflict } = await service.claimRunning(claimArgs)

      expect(error).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(data).toBeInstanceOf(ScheduleRunModel)
      expect(mocks.insertValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: `running`, scheduleId: `sc_sched001` })
      )
      expect(mocks.insertOnConflictDoNothingFn).toHaveBeenCalled()
    })

    it(`simulates two concurrent replicas racing the same due schedule — exactly one wins`, async () => {
      // Replica A's insert succeeds outright.
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow({ id: `sr_runA0001` })])
      const winner = await service.claimRunning(claimArgs)

      expect(winner.conflict).toBeUndefined()
      expect(winner.data).toBeInstanceOf(ScheduleRunModel)
      expect(winner.data?.id).toBe(`sr_runA0001`)

      // Replica B's insert hits the partial unique index on
      // schedule_runs(schedule_id) WHERE status='running' — ON CONFLICT DO
      // NOTHING means zero rows come back, never a thrown error.
      mocks.insertReturningFn.mockResolvedValueOnce([])
      const loser = await service.claimRunning(claimArgs)

      expect(loser.error).toBeUndefined()
      expect(loser.data).toBeNull()
      expect(loser.conflict).toBe(true)
    })

    it(`returns { error } instead of throwing when the insert query fails`, async () => {
      mocks.insertReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error, conflict } = await service.claimRunning(claimArgs)

      expect(data).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`hasRunning`, () => {
    it(`returns true when the schedule has a running row`, async () => {
      mocks.selectLimitFn.mockResolvedValueOnce([{ id: `sr_run00001` }])

      const { data, error } = await service.hasRunning(`sc_sched001`)

      expect(error).toBeUndefined()
      expect(data).toBe(true)
      expect(mocks.selectLimitFn).toHaveBeenCalledWith(1)
    })

    it(`returns false when the schedule has no running row`, async () => {
      mocks.selectLimitFn.mockResolvedValueOnce([])

      const { data, error } = await service.hasRunning(`sc_sched001`)

      expect(error).toBeUndefined()
      expect(data).toBe(false)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.selectLimitFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.hasRunning(`sc_sched001`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`listRunning`, () => {
    it(`returns every row still in running status, modeled`, async () => {
      const rows = [fakeRow({ id: `sr_run00001` }), fakeRow({ id: `sr_run00002` })]
      mocks.selectWhereFn.mockResolvedValueOnce(rows)

      const { data, error } = await service.listRunning()

      expect(error).toBeUndefined()
      expect(data).toHaveLength(2)
      expect(data?.every((r) => r instanceof ScheduleRunModel)).toBe(true)
    })

    it(`returns an empty array when nothing is running`, async () => {
      mocks.selectWhereFn.mockResolvedValueOnce([])

      const { data, error } = await service.listRunning()

      expect(error).toBeUndefined()
      expect(data).toEqual([])
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.selectWhereFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.listRunning()

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`markAsError`, () => {
    it(`short-circuits with a zero count when given no ids`, async () => {
      const { data, error } = await service.markAsError([], `pod deleted`)

      expect(error).toBeUndefined()
      expect(data).toEqual({ count: 0, ids: [] })
      expect(mocks.updateFn).not.toHaveBeenCalled()
    })

    it(`marks the given ids as error and returns their count`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([
        { id: `sr_run00001` },
        { id: `sr_run00002` },
      ])

      const { data, error } = await service.markAsError(
        [`sr_run00001`, `sr_run00002`],
        `pod not running`
      )

      expect(error).toBeUndefined()
      expect(data).toEqual({ count: 2, ids: [`sr_run00001`, `sr_run00002`] })
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: `error`, error: `pod not running` })
      )
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.markAsError([`sr_run00001`], `oops`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })
})
