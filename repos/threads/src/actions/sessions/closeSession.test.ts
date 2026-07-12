import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClose = vi.fn()
const mockCloseAll = vi.fn()
const mockResetEditor = vi.fn()
const mockClearFileTreeSyncTimers = vi.fn()
const mockGetActiveSession = vi.fn()
const mockSetActiveSession = vi.fn()
const mockRemoveOpenSession = vi.fn()
const mockResetOpenSessions = vi.fn()

vi.mock(`@TTH/services/sessionService`, () => ({
  sessionService: {
    close: (...args: unknown[]) => mockClose(...args),
    closeAll: (...args: unknown[]) => mockCloseAll(...args),
  },
}))

vi.mock(`@TTH/actions/editor/resetEditor`, () => ({
  resetEditor: (...args: unknown[]) => mockResetEditor(...args),
}))

vi.mock(`@TTH/actions/editor/handleFileTreeChanged`, () => ({
  clearFileTreeSyncTimers: (...args: unknown[]) => mockClearFileTreeSyncTimers(...args),
}))

vi.mock(`@TTH/state/accessors`, () => ({
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  setActiveSession: (...args: unknown[]) => mockSetActiveSession(...args),
  removeOpenSession: (...args: unknown[]) => mockRemoveOpenSession(...args),
  resetOpenSessions: (...args: unknown[]) => mockResetOpenSessions(...args),
}))

import { closeSession } from './closeSession'
import { closeAllSessions } from './closeAllSessions'

describe(`closeSession`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`closes the session via sessionService and removes it from openSessions`, () => {
    mockGetActiveSession.mockReturnValue(`other-session`)

    closeSession(`session-1`)

    expect(mockClose).toHaveBeenCalledWith(`session-1`, undefined)
    expect(mockRemoveOpenSession).toHaveBeenCalledWith(`session-1`)
  })

  it(`forwards opts (e.g. preserveStorage) to sessionService.close`, () => {
    mockGetActiveSession.mockReturnValue(`other-session`)

    closeSession(`session-1`, { preserveStorage: true })

    expect(mockClose).toHaveBeenCalledWith(`session-1`, { preserveStorage: true })
  })

  it(`resets editor state and clears activeSession when closing the ACTIVE session`, () => {
    mockGetActiveSession.mockReturnValue(`session-1`)

    closeSession(`session-1`)

    expect(mockSetActiveSession).toHaveBeenCalledWith(null)
    expect(mockClearFileTreeSyncTimers).toHaveBeenCalledOnce()
    expect(mockResetEditor).toHaveBeenCalledOnce()
  })

  it(`leaves editor state untouched when closing a BACKGROUND (non-active) session`, () => {
    mockGetActiveSession.mockReturnValue(`other-session`)

    closeSession(`session-1`)

    expect(mockSetActiveSession).not.toHaveBeenCalled()
    expect(mockClearFileTreeSyncTimers).not.toHaveBeenCalled()
    expect(mockResetEditor).not.toHaveBeenCalled()
  })
})

describe(`closeAllSessions`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`unconditionally closes all sessions, resets state, and resets the editor`, () => {
    closeAllSessions()

    expect(mockCloseAll).toHaveBeenCalledOnce()
    expect(mockResetOpenSessions).toHaveBeenCalledOnce()
    expect(mockSetActiveSession).toHaveBeenCalledWith(null)
    expect(mockClearFileTreeSyncTimers).toHaveBeenCalledOnce()
    expect(mockResetEditor).toHaveBeenCalledOnce()
  })
})
