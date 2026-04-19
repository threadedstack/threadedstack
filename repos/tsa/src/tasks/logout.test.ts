import { describe, it, expect, vi, beforeEach } from 'vitest'

const terminateSession = vi.fn().mockResolvedValue(undefined)
const listSessions = vi.fn().mockResolvedValue([])

vi.mock(`@TSA/services/sync/mutagenClient`, () => ({
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
}))

import { logout } from './logout'

describe(`logout`, () => {
  let mockAuth: { logout: ReturnType<typeof vi.fn> }
  let output: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = { logout: vi.fn() }
    output = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
  })

  it(`terminates sync sessions before removing credentials`, async () => {
    listSessions.mockResolvedValueOnce([
      { id: `s1`, name: `app`, status: `watching`, labels: {} },
    ])

    await logout.action!({ auth: mockAuth } as any)

    expect(terminateSession).toHaveBeenCalledWith(`s1`)
    expect(mockAuth.logout).toHaveBeenCalled()
  })

  it(`logs out even when no sync sessions exist`, async () => {
    listSessions.mockResolvedValueOnce([])

    await logout.action!({ auth: mockAuth } as any)

    expect(terminateSession).not.toHaveBeenCalled()
    expect(mockAuth.logout).toHaveBeenCalled()
  })

  it(`logs out even when sync termination fails`, async () => {
    listSessions.mockRejectedValueOnce(new Error(`daemon not running`))

    await logout.action!({ auth: mockAuth } as any)

    expect(mockAuth.logout).toHaveBeenCalled()
    expect(output.some((o) => o.includes(`Warning`))).toBe(true)
  })

  it(`reports per-session failures without printing false success`, async () => {
    listSessions.mockResolvedValueOnce([
      { id: `s1`, name: `app`, status: `watching`, labels: {} },
      { id: `s2`, name: `config`, status: `watching`, labels: {} },
    ])
    terminateSession
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(`session locked`))

    await logout.action!({ auth: mockAuth } as any)

    expect(mockAuth.logout).toHaveBeenCalled()
    expect(output.some((o) => o.includes(`Warning`) && o.includes(`1 session`))).toBe(
      true
    )
    expect(output.some((o) => o.includes(`tsa sync cleanup`))).toBe(true)
    expect(output.every((o) => !o.includes(`Sync sessions stopped`))).toBe(true)
  })
})
