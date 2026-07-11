import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler, createScheduler, ScheduleClaimConflictError } from './scheduler'
import { logger } from '@TBE/utils/logger'

// parseNextRun now lives in @tdsk/domain (shared with the resident runtime)
vi.mock('@tdsk/domain', () => ({
  isFeatureEnabled: vi.fn(() => true),
  parseNextRun: vi.fn().mockReturnValue(new Date(`2026-04-01T00:00:00Z`)),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/scheduler/rehydrator`, () => ({
  hydrateOrphanedRuns: vi.fn().mockResolvedValue(undefined),
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
      scheduleRun: {
        listRunning: vi.fn().mockResolvedValue({ data: [] }),
        markAsError: vi.fn().mockResolvedValue({ data: { count: 0, ids: [] } }),
        hasRunning: vi.fn().mockResolvedValue({ data: false }),
      },
    },
  }) as any

/**
 * The scheduler tick fires executors as fire-and-forget (so a long-running
 * executor never blocks the next tick). Tests that assert post-executor side
 * effects (incrementErrors, markRun on downstream schedules, etc.) need to
 * flush pending microtasks after awaiting the tick to see them.
 */
const flushPending = async () => {
  await vi.runAllTimersAsync()
  await Promise.resolve()
  await Promise.resolve()
}

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

    it(`hydrates runs left in running when app is wired`, async () => {
      const { hydrateOrphanedRuns } = await import(`@TBE/services/scheduler/rehydrator`)
      const mockHydrate = vi.mocked(hydrateOrphanedRuns)
      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })

      // Constructor with app so hydration path fires.
      scheduler = new Scheduler(mockDb, undefined, {} as any)
      scheduler.start()

      // Rather than blanket-failing every running row, delegate to the
      // rehydrator which inspects each pod and completes honestly.
      expect(mockHydrate).toHaveBeenCalledTimes(1)
    })

    it(`skips hydration and warns when app is not wired`, () => {
      mockDb.services.schedule.listDue.mockResolvedValue({ data: [] })

      // No app passed → hydration is skipped and a warning is logged.
      scheduler = new Scheduler(mockDb)
      scheduler.start()

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`skipping orphaned-run hydration`)
      )
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
      await flushPending()

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
      await flushPending()

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
      await flushPending()

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
      await flushPending()

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
      await flushPending()

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
      await flushPending()

      expect(mockExecutor).toHaveBeenCalledWith(mockSchedule)
    })

    it(`should not call executeAgent when none is provided`, async () => {
      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      await scheduler.tick()
      await flushPending()

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
      await flushPending()

      expect(mockDb.services.schedule.incrementErrors).toHaveBeenCalledWith(`sched-1`)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Agent crashed`))
    })

    it(`skips cleanly (no error recorded) when the executor loses the atomic cross-replica claim`, async () => {
      // Simulates two backend replicas racing the same due schedule: both pass
      // the best-effort hasRunning() check, both reach the executor, but the
      // atomic partial-unique-index claim (ScheduleRun.claimRunning) means only
      // one replica's executor actually runs — the other's executor throws
      // ScheduleClaimConflictError. This must be treated as a benign skip, NOT
      // an error — incrementErrors must never fire for a lost claim race.
      const mockExecutor = vi
        .fn()
        .mockRejectedValue(new ScheduleClaimConflictError(`sched-1`))
      scheduler = new Scheduler(mockDb, mockExecutor)

      mockDb.services.schedule.listDue.mockResolvedValue({
        data: [mockSchedule],
      })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      await scheduler.tick()
      await flushPending()

      expect(mockDb.services.schedule.incrementErrors).not.toHaveBeenCalled()
      expect(logger.error).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`lost the atomic claim race`)
      )
    })

    it(`skips a schedule that already has a run in flight (serialize per schedule)`, async () => {
      // Regression: a manual trigger firing while a natural cron slot was
      // pending let TWO coding-cycle runs start concurrently and each open a
      // PR for the same task (duplicate PRs, wasted claude turn). Now the
      // scheduler MUST refuse to start a new run when hasRunning returns true.
      const executor = vi.fn().mockResolvedValue(undefined)
      scheduler = new Scheduler(mockDb, executor)

      mockDb.services.schedule.listDue.mockResolvedValue({ data: [mockSchedule] })
      mockDb.services.schedule.markRun.mockResolvedValue({})
      mockDb.services.scheduleRun.hasRunning.mockResolvedValue({ data: true })

      await scheduler.tick()
      await flushPending()

      // Executor is NOT called.
      expect(executor).not.toHaveBeenCalled()
      // next_run_at IS advanced so the schedule doesn't stay wedged.
      expect(mockDb.services.schedule.markRun).toHaveBeenCalledWith(
        `sched-1`,
        expect.any(Date)
      )
      // Log tells the operator we skipped rather than errored.
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`prior run is still in flight`)
      )
    })

    it(`does not block the tick on a slow executor (fire-and-forget)`, async () => {
      // Regression test for the incident where an adversary review took 10+
      // min and prevented every subsequent tick from picking up new due
      // schedules — coding cycle triggers vanished silently until the slow
      // executor finally released. Now the tick must return quickly even
      // when the executor promise stays pending indefinitely.
      let slowResolver: () => void = () => undefined
      const slowExecutor = vi
        .fn()
        .mockImplementation(
          () => new Promise<void>((resolve) => (slowResolver = resolve))
        )
      scheduler = new Scheduler(mockDb, slowExecutor)

      mockDb.services.schedule.listDue.mockResolvedValue({ data: [mockSchedule] })
      mockDb.services.schedule.markRun.mockResolvedValue({})

      // Tick resolves without waiting for the executor. Flush pending so
      // the fire-and-forget processSchedule can reach the executor invoke.
      await scheduler.tick()
      await flushPending()

      // Executor was invoked but the tick did not wait for it.
      expect(slowExecutor).toHaveBeenCalledWith(mockSchedule)
      // Cleanup so the dangling promise does not leak into other tests.
      slowResolver()
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
      // With fire-and-forget dispatch the tick returns before executors
      // start; a real-timer microtask flush lets both processSchedule
      // promises reach their first await inside the executor.
      await new Promise((r) => setImmediate(r))
      await new Promise((r) => setImmediate(r))

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
      await flushPending()

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
