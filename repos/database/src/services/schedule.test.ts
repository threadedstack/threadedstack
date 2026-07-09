import { Schedule } from './schedule'
import { EScheduleType, Schedule as ScheduleModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger to avoid config/db initialization side-effects — its module
// load imports db.config, which throws in the env-less deploy test step (see
// apiKey.test.ts for the established pattern).
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

/**
 * Mock Drizzle DB covering the two chains schedule.ts drives directly:
 * update().set().where().returning() and db.query.schedules.findMany().
 */
const createMockDb = () => {
  const updateReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const updateWhereFn = vi.fn((..._args: any[]) => ({ returning: updateReturningFn }))
  const updateSetFn = vi.fn((..._args: any[]) => ({ where: updateWhereFn }))
  const updateFn = vi.fn((..._args: any[]) => ({ set: updateSetFn }))

  const findManyFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))

  return {
    db: {
      update: updateFn,
      query: { schedules: { findMany: findManyFn } },
    } as any,
    updateFn,
    updateSetFn,
    updateWhereFn,
    updateReturningFn,
    findManyFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `sc_sched001`,
  orgId: `og_org00001`,
  projectId: `pj_proj0001`,
  sandboxId: `sb_sandbox1`,
  prompt: `do the thing`,
  enabled: true,
  cronExpression: `0 * * * *`,
  lastRunAt: null,
  nextRunAt: new Date(),
  timeoutMs: null,
  consecutiveErrors: 0,
  maxConsecutiveErrors: 5,
  type: EScheduleType.prompt,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Schedule service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Schedule

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Schedule({ db: mocks.db, config: {} } as any)
  })

  describe(`listDue`, () => {
    it(`returns every enabled, due schedule, modeled`, async () => {
      const rows = [fakeRow({ id: `sc_sched001` }), fakeRow({ id: `sc_sched002` })]
      mocks.findManyFn.mockResolvedValueOnce(rows)

      const { data, error } = await service.listDue()

      expect(error).toBeUndefined()
      expect(data).toHaveLength(2)
      expect(data?.every((r) => r instanceof ScheduleModel)).toBe(true)
    })

    it(`returns an empty array when nothing is due`, async () => {
      mocks.findManyFn.mockResolvedValueOnce([])

      const { data, error } = await service.listDue()

      expect(error).toBeUndefined()
      expect(data).toEqual([])
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.findManyFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.listDue()

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`markRun`, () => {
    it(`writes lastRunAt/nextRunAt and models the updated row`, async () => {
      const nextRunAt = new Date(`2026-07-10T00:00:00Z`)
      const row = fakeRow({ nextRunAt })
      mocks.updateReturningFn.mockResolvedValueOnce([row])

      const { data, error } = await service.markRun(`sc_sched001`, nextRunAt)

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(ScheduleModel)
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ nextRunAt })
      )
    })

    it(`returns { error } when the schedule does not exist`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.markRun(`sc_missing01`, new Date())

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`Schedule not found`)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`connection lost`))

      const { data, error } = await service.markRun(`sc_sched001`, new Date())

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`connection lost`)
    })
  })

  describe(`resetErrors`, () => {
    it(`resets consecutiveErrors to 0 and models the updated row`, async () => {
      const row = fakeRow({ consecutiveErrors: 0 })
      mocks.updateReturningFn.mockResolvedValueOnce([row])

      const { data, error } = await service.resetErrors(`sc_sched001`)

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(ScheduleModel)
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ consecutiveErrors: 0 })
      )
    })

    it(`returns { error } when the schedule does not exist`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.resetErrors(`sc_missing01`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`Schedule not found`)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.resetErrors(`sc_sched001`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`incrementErrors`, () => {
    it(`increments consecutiveErrors and models the updated row`, async () => {
      const row = fakeRow({ consecutiveErrors: 1 })
      mocks.updateReturningFn.mockResolvedValueOnce([row])

      const { data, error } = await service.incrementErrors(`sc_sched001`)

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(ScheduleModel)
      expect(data?.consecutiveErrors).toBe(1)
      expect(mocks.updateSetFn).toHaveBeenCalledTimes(1)
      const setArg = mocks.updateSetFn.mock.calls[0][0]
      expect(setArg).toHaveProperty(`consecutiveErrors`)
      expect(setArg).toHaveProperty(`enabled`)
    })

    it(`returns { error } when the schedule does not exist`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.incrementErrors(`sc_missing01`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`Schedule not found`)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.incrementErrors(`sc_sched001`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })
})
