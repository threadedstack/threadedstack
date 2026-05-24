import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler, createScheduler } from './scheduler'
import { logger } from '@TBE/utils/logger'

vi.mock('@tdsk/domain', () => ({
  isFeatureEnabled: vi.fn(() => true),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/scheduler/cronParser`, () => ({
  parseNextRun: vi.fn().mockReturnValue(new Date(`2026-04-01T00:00:00Z`)),
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const buildMockDb = () =>
  ({
    services: {
      schedule: {
        listDue: vi.fn(),
        markRun: vi.fn(),
        incrementErrors: vi.fn(),
      },
    },
  }) as any

const mockSchedule = {
  id: `sched-1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  cronExpression: `*/5 * * * *`,
  prompt: `Run the task`,
  enabled: true,
  nextRunAt: new Date(`2026-03-01T10:00:00Z`),
}

// ── SCHEDULER ────────────────────────────────────────────────────────

describe(`Scheduler`, () => {
  let scheduler: Scheduler
  let mockDb: ReturnType<typeof buildMockDb>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockDb = buildMockDb()
    scheduler = new Scheduler(mockDb)
  })

  afterEach(() => {
    scheduler.stop()
    vi.useRealTimers()
  })

  describe(`start`, () => {
    it(`should not start when schedules feature is disabled`, async () => {
      const { isFeatureEnabled } = await import('@tdsk/domain')
      const mockIsEnabled = vi.mocked(isFeatureEnabled)
      mockIsEnabled.mockReturnValue(false)

      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })
      scheduler.start()

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`disabled`))
      expect(mockDb.services.schedule.listDue).not.toHaveBeenCalled()

      mockIsEnabled.mockReturnValue(true)
    })

    it(`should call tick immediately and set up interval`, () => {
      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })

      scheduler.start()

      // tick is called immediately
      expect(mockDb.services.schedule.listDue).toHaveBeenCalledTimes(1)
    })

    it(`should warn if already running`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })

      scheduler.start()
      scheduler.start()

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Already running`))
    })
  })

  describe(`stop`, () => {
    it(`should clear the interval`, () => {
      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })

      scheduler.start()
      scheduler.stop()

      // After stop, advancing timer should NOT trigger another listDue
      const callCount = mockDb.services.schedule.listDue.mock.calls.length
      vi.advanceTimersByTime(120_000)

      expect(mockDb.services.schedule.listDue.mock.calls.length).toBe(callCount)
    })

    it(`should be safe to call when not running`, () => {
      // Should not throw
      expect(() => scheduler.stop()).not.toThrow()
    })
  })

  describe(`tick`, () => {
    it(`should do nothing when no due schedules`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })

      await scheduler.tick()

      expect(mockDb.services.schedule.listDue).toHaveBeenCalledTimes(1)
      expect(mockDb.services.schedule.markRun).not.toHaveBeenCalled()
    })

    it(`should do nothing when listDue returns null data`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({ data: null })

      await scheduler.tick()

      expect(mockDb.services.schedule.markRun).not.toHaveBeenCalled()
    })

    it(`should log and return when listDue returns error`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({
        error: { message: `DB connection lost` },
      })

      await scheduler.tick()

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`DB connection lost`)
      )
      expect(mockDb.services.schedule.markRun).not.toHaveBeenCalled()
    })

    it(`should call markRun with next run time for due schedules`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      await scheduler.tick()

      expect(mockDb.services.schedule.markRun).toHaveBeenCalledWith(
        `sched-1`,
        expect.any(Date)
      )
    })

    it(`should call incrementErrors when processing fails`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockRejectedValue(new Error(`Write failed`))
      mockDb.services.schedule.incrementErrors.mockResolvedValue({})

      await scheduler.tick()

      expect(mockDb.services.schedule.incrementErrors).toHaveBeenCalledWith(`sched-1`)
    })

    it(`should process multiple due schedules`, async () => {
      const schedule2 = { ...mockSchedule, id: `sched-2`, agentId: `agent-2` }
      const schedule3 = { ...mockSchedule, id: `sched-3`, agentId: `agent-3` }

      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule, schedule2, schedule3],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      await scheduler.tick()

      expect(mockDb.services.schedule.markRun).toHaveBeenCalledTimes(3)
      expect(mockDb.services.schedule.markRun).toHaveBeenCalledWith(
        `sched-1`,
        expect.any(Date)
      )
      expect(mockDb.services.schedule.markRun).toHaveBeenCalledWith(
        `sched-2`,
        expect.any(Date)
      )
      expect(mockDb.services.schedule.markRun).toHaveBeenCalledWith(
        `sched-3`,
        expect.any(Date)
      )
    })

    it(`should continue processing remaining schedules when one fails`, async () => {
      const schedule2 = { ...mockSchedule, id: `sched-2` }

      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule, schedule2],
      })
      mockDb.services.schedule.markRun
        .mockRejectedValueOnce(new Error(`Failed first`))
        .mockResolvedValueOnce({})
      mockDb.services.schedule.incrementErrors.mockResolvedValue({})

      await scheduler.tick()

      // First schedule failed and got incrementErrors, second succeeded
      expect(mockDb.services.schedule.incrementErrors).toHaveBeenCalledWith(`sched-1`)
      expect(mockDb.services.schedule.markRun).toHaveBeenCalledWith(
        `sched-2`,
        expect.any(Date)
      )
    })

    it(`should handle incrementErrors failure gracefully`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockRejectedValue(new Error(`Write failed`))
      mockDb.services.schedule.incrementErrors.mockRejectedValue(new Error(`Inc failed`))

      // Should not throw
      await scheduler.tick()

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Inc failed`))
    })

    it(`should call executeAgent callback when provided`, async () => {
      const mockExecutor = vi.fn().mockResolvedValue(undefined)
      scheduler = new Scheduler(mockDb, mockExecutor)

      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      await scheduler.tick()

      expect(mockExecutor).toHaveBeenCalledWith(mockSchedule)
    })

    it(`should not call executeAgent when none is provided`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      await scheduler.tick()

      // No error, just markRun
      expect(mockDb.services.schedule.markRun).toHaveBeenCalledTimes(1)
    })

    it(`should increment errors when executeAgent fails`, async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error(`Agent crashed`))
      scheduler = new Scheduler(mockDb, mockExecutor)

      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})
      mockDb.services.schedule.incrementErrors.mockResolvedValue({})

      await scheduler.tick()

      expect(mockDb.services.schedule.incrementErrors).toHaveBeenCalledWith(`sched-1`)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Agent crashed`))
    })

    it(`should process schedules concurrently, not sequentially`, async () => {
      const schedule2 = { ...mockSchedule, id: `sched-2` }
      const callOrder: string[] = []

      let resolveFirst!: () => void
      let resolveSecond!: () => void
      const firstDone = new Promise<void>((r) => {
        resolveFirst = r
      })
      const secondDone = new Promise<void>((r) => {
        resolveSecond = r
      })

      const mockExecutor = vi.fn().mockImplementation(async (s: any) => {
        callOrder.push(`start:${s.id}`)
        if (s.id === `sched-1`) {
          await secondDone
          resolveFirst()
        } else {
          resolveSecond()
          await firstDone
        }
        callOrder.push(`end:${s.id}`)
      })

      scheduler = new Scheduler(mockDb, mockExecutor)
      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule, schedule2],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      vi.useRealTimers()
      await scheduler.tick()

      expect(callOrder[0]).toBe(`start:sched-1`)
      expect(callOrder[1]).toBe(`start:sched-2`)
      expect(mockExecutor).toHaveBeenCalledTimes(2)

      vi.useFakeTimers()
    })

    it(`should continue processing other schedules when one executor fails`, async () => {
      const schedule2 = { ...mockSchedule, id: `sched-2`, agentId: `agent-2` }
      const mockExecutor = vi
        .fn()
        .mockRejectedValueOnce(new Error(`First agent crashed`))
        .mockResolvedValueOnce(undefined)

      scheduler = new Scheduler(mockDb, mockExecutor)

      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule, schedule2],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})
      mockDb.services.schedule.incrementErrors.mockResolvedValue({})

      await scheduler.tick()

      expect(mockExecutor).toHaveBeenCalledTimes(2)
      expect(mockDb.services.schedule.incrementErrors).toHaveBeenCalledWith(`sched-1`)
    })
  })
})

// ── FACTORY ──────────────────────────────────────────────────────────

describe(`createScheduler`, () => {
  it(`should return a Scheduler instance`, () => {
    const mockDb = buildMockDb()
    const scheduler = createScheduler(mockDb)
    expect(scheduler).toBeInstanceOf(Scheduler)
  })
})
