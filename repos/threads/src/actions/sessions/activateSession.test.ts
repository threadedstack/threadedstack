import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetActiveSession = vi.fn()
const mockSetActiveSession = vi.fn()
const mockGetOpenSessions = vi.fn()
const mockResetEditor = vi.fn()
const mockLoadDirectory = vi.fn()

vi.mock(`@TTH/state/accessors`, () => ({
  getActiveSession: () => mockGetActiveSession(),
  setActiveSession: (...args: any[]) => mockSetActiveSession(...args),
  getOpenSessions: () => mockGetOpenSessions(),
}))

vi.mock(`@TTH/actions/editor/resetEditor`, () => ({
  resetEditor: (...args: any[]) => mockResetEditor(...args),
}))

vi.mock(`@TTH/actions/editor/loadDirectory`, () => ({
  loadDirectory: (...args: any[]) => mockLoadDirectory(...args),
}))

import { activateSession } from './activateSession'

describe(`activateSession`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOpenSessions.mockReturnValue(new Map())
  })

  it(`always calls setActiveSession first, even on the same-session no-op path`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)

    activateSession(`session-1`)

    expect(mockSetActiveSession).toHaveBeenCalledWith(`session-1`)
  })

  it(`SAME-SESSION NO-OP: does not call resetEditor or loadDirectory when re-activating the already-active session`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)
    mockGetOpenSessions.mockReturnValue(
      new Map([[`session-1`, { workdir: `/some/dir` }]])
    )

    activateSession(`session-1`)

    expect(mockResetEditor).not.toHaveBeenCalled()
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`calls resetEditor when switching to a different session`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)

    activateSession(`session-2`)

    expect(mockResetEditor).toHaveBeenCalledTimes(1)
  })

  it(`calls resetEditor on the first-ever activation (no prior active session)`, () => {
    mockGetActiveSession.mockReturnValue(null)

    activateSession(`session-1`)

    expect(mockResetEditor).toHaveBeenCalledTimes(1)
  })

  it(`calls loadDirectory with the session's workdir and sessionId when the target session has a workdir`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)
    mockGetOpenSessions.mockReturnValue(
      new Map([[`session-2`, { workdir: `/repo/src` }]])
    )

    activateSession(`session-2`)

    expect(mockLoadDirectory).toHaveBeenCalledWith(`/repo/src`, `session-2`)
  })

  it(`does not call loadDirectory when the target session has a falsy/missing workdir (resetEditor still runs)`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)
    mockGetOpenSessions.mockReturnValue(new Map([[`session-2`, { workdir: `` }]]))

    activateSession(`session-2`)

    expect(mockResetEditor).toHaveBeenCalledTimes(1)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })

  it(`does not call loadDirectory when the target session has no entry in getOpenSessions at all`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)
    mockGetOpenSessions.mockReturnValue(new Map())

    activateSession(`session-2`)

    expect(mockResetEditor).toHaveBeenCalledTimes(1)
    expect(mockLoadDirectory).not.toHaveBeenCalled()
  })
})
