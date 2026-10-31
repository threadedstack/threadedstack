import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RetentionCleanup, createRetentionCleanup } from './retentionCleanup'
import { logger } from '@TBE/utils/logger'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const RETENTION_TICK_MS = 24 * 60 * 60 * 1000

const buildMockDb = () =>
  ({
    services: {
      thread: {
        pruneExpiredThreads: vi.fn(),
      },
    },
  }) as any

const flushPending = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe(`RetentionCleanup`, () => {
  let cleanup: RetentionCleanup
  let mockDb: ReturnType<typeof buildMockDb>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockDb = buildMockDb()
    mockDb.services.thread.pruneExpiredThreads.mockResolvedValue([])
    cleanup = new RetentionCleanup(mockDb)
  })

  afterEach(() => {
    cleanup.stop()
    vi.useRealTimers()
  })

  describe(`createRetentionCleanup`, () => {
    it(`returns a RetentionCleanup instance`, () => {
      expect(createRetentionCleanup(mockDb)).toBeInstanceOf(RetentionCleanup)
    })
  })

  describe(`start`, () => {
    it(`runs pruneExpiredThreads immediately when started`, async () => {
      cleanup.start()
      await flushPending()

      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(1)
    })

    it(`runs again after the 24h interval elapses`, async () => {
      cleanup.start()
      await flushPending()
      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(RETENTION_TICK_MS)

      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(2)
    })

    it(`does not start a second interval when already running`, () => {
      cleanup.start()
      cleanup.start()

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Already running`)
      )
    })

    it(`logs the org count and total deleted-thread count on success`, async () => {
      mockDb.services.thread.pruneExpiredThreads.mockResolvedValue([
        { orgId: `org-1`, deletedThreadIds: [`t1`, `t2`] },
        { orgId: `org-2`, deletedThreadIds: [`t3`] },
      ])

      cleanup.start()
      await flushPending()

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Pruned 3 expired thread(s) across 2 org(s)`)
      )
    })

    it(`catches and logs a rejected prune call instead of throwing/crashing`, async () => {
      mockDb.services.thread.pruneExpiredThreads.mockRejectedValueOnce(
        new Error(`boom`)
      )

      expect(() => cleanup.start()).not.toThrow()
      await flushPending()

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Prune run failed`),
        `boom`
      )
    })

    it(`a rejected tick does not stop the next scheduled tick from running`, async () => {
      mockDb.services.thread.pruneExpiredThreads.mockRejectedValueOnce(
        new Error(`boom`)
      )

      cleanup.start()
      await flushPending()
      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(1)

      mockDb.services.thread.pruneExpiredThreads.mockResolvedValue([])
      await vi.advanceTimersByTimeAsync(RETENTION_TICK_MS)

      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(2)
    })
  })

  describe(`stop`, () => {
    it(`clears the interval so no further runs occur`, async () => {
      cleanup.start()
      await flushPending()
      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(1)

      cleanup.stop()
      await vi.advanceTimersByTimeAsync(RETENTION_TICK_MS)

      expect(mockDb.services.thread.pruneExpiredThreads).toHaveBeenCalledTimes(1)
    })

    it(`is a no-op when not running`, () => {
      expect(() => cleanup.stop()).not.toThrow()
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining(`Stopped`)
      )
    })
  })
})
