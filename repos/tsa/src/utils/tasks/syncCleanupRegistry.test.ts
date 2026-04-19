import type { IMutagenClient } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncManager } from '@TSA/services/sync/syncManager'
import {
  registerSyncCleanup,
  clearSyncCleanup,
  runSyncCleanup,
} from './syncCleanupRegistry'

const mockClient: IMutagenClient = {
  createSession: vi.fn().mockResolvedValue({}),
  terminateSession: vi.fn().mockResolvedValue(undefined),
  pauseSession: vi.fn().mockResolvedValue(undefined),
  resumeSession: vi.fn().mockResolvedValue(undefined),
  flushSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi
    .fn()
    .mockResolvedValue([
      { id: `s1`, name: `app`, status: `watching`, labels: { sandboxId: `sb_1` } },
    ]),
  getSession: vi.fn().mockResolvedValue(null),
  ensureDaemon: vi.fn().mockResolvedValue(undefined),
  stopDaemon: vi.fn().mockResolvedValue(undefined),
}

describe(`syncCleanupRegistry`, () => {
  let manager: SyncManager

  beforeEach(() => {
    vi.clearAllMocks()
    clearSyncCleanup()
    manager = new SyncManager(mockClient)
  })

  it(`runSyncCleanup returns false when nothing is registered`, async () => {
    const result = await runSyncCleanup()
    expect(result).toBe(false)
    expect(mockClient.listSessions).not.toHaveBeenCalled()
  })

  it(`runSyncCleanup returns true when entries were cleaned`, async () => {
    registerSyncCleanup(`sb_1`, manager)
    const result = await runSyncCleanup()
    expect(result).toBe(true)
  })

  it(`terminates sessions for registered sandbox on runSyncCleanup`, async () => {
    registerSyncCleanup(`sb_1`, manager)
    await runSyncCleanup()
    expect(mockClient.listSessions).toHaveBeenCalledWith({ sandboxId: `sb_1` })
    expect(mockClient.terminateSession).toHaveBeenCalledWith(`s1`)
  })

  it(`clearSyncCleanup prevents subsequent runSyncCleanup from acting`, async () => {
    registerSyncCleanup(`sb_1`, manager)
    clearSyncCleanup()
    await runSyncCleanup()
    expect(mockClient.listSessions).not.toHaveBeenCalled()
  })

  it(`supports multiple registrations`, async () => {
    const mockClient2: IMutagenClient = {
      ...mockClient,
      listSessions: vi
        .fn()
        .mockResolvedValue([
          { id: `s2`, name: `config`, status: `watching`, labels: { sandboxId: `sb_2` } },
        ]),
      terminateSession: vi.fn().mockResolvedValue(undefined),
    }
    const manager2 = new SyncManager(mockClient2)

    registerSyncCleanup(`sb_1`, manager)
    registerSyncCleanup(`sb_2`, manager2)
    await runSyncCleanup()

    expect(mockClient.terminateSession).toHaveBeenCalledWith(`s1`)
    expect(mockClient2.terminateSession).toHaveBeenCalledWith(`s2`)
  })

  it(`swallows errors during cleanup without throwing`, async () => {
    ;(mockClient.listSessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error(`daemon not running`)
    )
    const stderrSpy = vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
    registerSyncCleanup(`sb_1`, manager)
    await expect(runSyncCleanup()).resolves.toBe(true)
    stderrSpy.mockRestore()
  })

  it(`second runSyncCleanup is a no-op after first clears entries`, async () => {
    registerSyncCleanup(`sb_1`, manager)
    const first = await runSyncCleanup()
    expect(first).toBe(true)
    expect(mockClient.listSessions).toHaveBeenCalledTimes(1)

    const second = await runSyncCleanup()
    expect(second).toBe(false)
    expect(mockClient.listSessions).toHaveBeenCalledTimes(1)
  })
})
