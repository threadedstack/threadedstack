import { describe, it, expect, vi, beforeEach } from 'vitest'

// sync.ts instantiates CliDriver at module scope, so the mock factory must
// be self-contained (no outer variable references — they'd be in TDZ).
vi.mock(`@TSA/services/sync/mutagenClient`, () => {
  const terminateSession = vi.fn().mockResolvedValue(undefined)
  const listSessions = vi.fn().mockResolvedValue([])
  return {
    CliDriver: vi.fn().mockImplementation(() => ({
      terminateSession,
      listSessions,
      ensureDaemon: vi.fn().mockResolvedValue(undefined),
      stopDaemon: vi.fn().mockResolvedValue(undefined),
      pauseSession: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
      flushSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({}),
    })),
  }
})

import { sync } from './sync'
import { CliDriver } from '@TSA/services/sync/mutagenClient'

// Grab mock functions from the instance created at sync.ts module scope
const driverInstance = vi.mocked(CliDriver).mock.results[0].value
const terminateSession = driverInstance.terminateSession as ReturnType<typeof vi.fn>
const listSessions = driverInstance.listSessions as ReturnType<typeof vi.fn>

describe(`sync cleanup subtask`, () => {
  let output: string[]
  let mockAuth: {
    loggedIn: ReturnType<typeof vi.fn>
    isExpired: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    mockAuth = {
      loggedIn: vi.fn().mockReturnValue(true),
      isExpired: vi.fn().mockReturnValue(false),
    }
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
  })

  const cleanupAction = sync.tasks!.cleanup.action!

  it(`terminates only errored and disconnected sessions`, async () => {
    listSessions.mockResolvedValueOnce([
      { id: `s1`, name: `app`, status: `errored`, labels: { sandboxId: `sb_1` } },
      { id: `s2`, name: `config`, status: `disconnected`, labels: { sandboxId: `sb_2` } },
      { id: `s3`, name: `live`, status: `watching`, labels: { sandboxId: `sb_3` } },
    ])

    await cleanupAction({ auth: mockAuth } as any)

    expect(terminateSession).toHaveBeenCalledTimes(2)
    expect(terminateSession).toHaveBeenCalledWith(`s1`)
    expect(terminateSession).toHaveBeenCalledWith(`s2`)
    expect(output.some((o) => o.includes(`2 orphaned`))).toBe(true)
    expect(output.some((o) => o.includes(`Cleaned up 2`))).toBe(true)
  })

  it(`is a no-op when no orphaned sessions exist`, async () => {
    listSessions.mockResolvedValueOnce([
      { id: `s1`, name: `app`, status: `watching`, labels: { sandboxId: `sb_1` } },
    ])

    await cleanupAction({ auth: mockAuth } as any)

    expect(terminateSession).not.toHaveBeenCalled()
    expect(output.some((o) => o.includes(`No orphaned sessions`))).toBe(true)
  })

  it(`is a no-op when no sessions exist at all`, async () => {
    listSessions.mockResolvedValueOnce([])

    await cleanupAction({ auth: mockAuth } as any)

    expect(terminateSession).not.toHaveBeenCalled()
    expect(output.some((o) => o.includes(`No orphaned sessions`))).toBe(true)
  })

  it(`reports partial termination failures`, async () => {
    listSessions.mockResolvedValueOnce([
      { id: `s1`, name: `app`, status: `errored`, labels: { sandboxId: `sb_1` } },
      { id: `s2`, name: `config`, status: `errored`, labels: { sandboxId: `sb_2` } },
    ])
    terminateSession
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(`session locked`))

    await cleanupAction({ auth: mockAuth } as any)

    expect(output.some((o) => o.includes(`Warning`) && o.includes(`1 session`))).toBe(
      true
    )
    expect(output.some((o) => o.includes(`Cleaned up 1`))).toBe(true)
  })
})
