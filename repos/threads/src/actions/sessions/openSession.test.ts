import type { TOpenSession, TSessionEventHandlers } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ESandboxSessionVisibility } from '@tdsk/domain'

const mockToastInfo = vi.fn()
const mockToastError = vi.fn()
const mockOpen = vi.fn()
const mockLoadDirectory = vi.fn()
const mockSetOpenSession = vi.fn()
const mockGetOpenSessions = vi.fn()
const mockGetActiveSession = vi.fn()
const mockSetActiveSession = vi.fn()
const mockRemoveOpenSession = vi.fn()
const mockSetBackendSessions = vi.fn()

vi.mock(`sonner`, () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

vi.mock(`@TTH/services/sessionService`, () => ({
  sessionService: {
    open: (...args: unknown[]) => mockOpen(...args),
  },
}))

vi.mock(`@TTH/actions/editor/loadDirectory`, () => ({
  loadDirectory: (...args: unknown[]) => mockLoadDirectory(...args),
}))

vi.mock(`@TTH/state/accessors`, () => ({
  setOpenSession: (...args: unknown[]) => mockSetOpenSession(...args),
  getOpenSessions: (...args: unknown[]) => mockGetOpenSessions(...args),
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  setActiveSession: (...args: unknown[]) => mockSetActiveSession(...args),
  removeOpenSession: (...args: unknown[]) => mockRemoveOpenSession(...args),
  setBackendSessions: (...args: unknown[]) => mockSetBackendSessions(...args),
}))

import { openSession } from './openSession'

const makeOpenSessionData = (overrides: Partial<TOpenSession> = {}): TOpenSession => ({
  runtime: `node`,
  threadId: `thread-1`,
  sandboxId: `sandbox-1`,
  sessionId: `session-1`,
  projectId: `project-1`,
  instanceId: `instance-1`,
  podOwnerUserId: `user-1`,
  visibility: ESandboxSessionVisibility.private,
  ...overrides,
})

describe(`openSession`, () => {
  let capturedHandlers: TSessionEventHandlers

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOpenSessions.mockReturnValue(new Map())
    mockGetActiveSession.mockReturnValue(null)
    mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
      capturedHandlers = handlers
      return Promise.resolve(`session-1`)
    })
  })

  it(`sets the active session and returns sessionId/instanceId once open resolves`, async () => {
    mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
      capturedHandlers = handlers
      handlers.onSetup(makeOpenSessionData())
      return Promise.resolve(`session-1`)
    })

    const result = await openSession({
      orgId: `org-1`,
      sandboxId: `sandbox-1`,
      projectId: `project-1`,
    })

    expect(result).toEqual({ sessionId: `session-1`, instanceId: `instance-1` })
    expect(mockSetActiveSession).toHaveBeenCalledWith(`session-1`)
  })

  describe(`onSetup`, () => {
    it(`calls setOpenSession with the sessionId and data`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        const data = makeOpenSessionData()
        handlers.onSetup(data)
        return Promise.resolve(data.sessionId)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockSetOpenSession).toHaveBeenCalledWith(
        `session-1`,
        expect.objectContaining({ sessionId: `session-1`, instanceId: `instance-1` })
      )
    })

    it(`calls loadDirectory when data.workdir is set`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        const data = makeOpenSessionData({ workdir: `/workspace` })
        handlers.onSetup(data)
        return Promise.resolve(data.sessionId)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockLoadDirectory).toHaveBeenCalledWith(`/workspace`, `session-1`)
    })

    it(`does not call loadDirectory when data.workdir is absent`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onSetup(makeOpenSessionData({ workdir: undefined }))
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockLoadDirectory).not.toHaveBeenCalled()
    })
  })

  describe(`onVisibilityChange`, () => {
    it(`merges the new visibility onto the existing open session`, async () => {
      const existing = makeOpenSessionData({
        visibility: ESandboxSessionVisibility.private,
      })
      mockGetOpenSessions.mockReturnValue(new Map([[`session-1`, existing]]))
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onVisibilityChange?.(`session-1`, ESandboxSessionVisibility.public)
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockSetOpenSession).toHaveBeenCalledWith(`session-1`, {
        ...existing,
        visibility: ESandboxSessionVisibility.public,
      })
    })

    it(`is a no-op when the session is not in openSessions`, async () => {
      mockGetOpenSessions.mockReturnValue(new Map())
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onVisibilityChange?.(`session-1`, ESandboxSessionVisibility.public)
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockSetOpenSession).not.toHaveBeenCalled()
    })
  })

  describe(`onSessionsUpdated`, () => {
    it(`calls setBackendSessions with the sandboxId and sessions`, async () => {
      const sessions = [{ id: `sess-a` }] as any
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onSessionsUpdated?.(`sandbox-1`, sessions)
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockSetBackendSessions).toHaveBeenCalledWith(`sandbox-1`, sessions)
    })
  })

  describe(`onUserJoined / onUserLeft / onSandboxStopping / onDisconnect`, () => {
    it(`toasts info on onUserJoined`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onUserJoined?.()
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockToastInfo).toHaveBeenCalledWith(
        `User joined your session`,
        expect.objectContaining({ duration: 3000 })
      )
    })

    it(`toasts info on onUserLeft`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onUserLeft?.()
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockToastInfo).toHaveBeenCalledWith(
        `User left your session`,
        expect.objectContaining({ duration: 3000 })
      )
    })

    it(`toasts info on onSandboxStopping`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onSandboxStopping?.()
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockToastInfo).toHaveBeenCalledWith(
        `Sandbox is being stopped by another user`,
        expect.objectContaining({ duration: 5000 })
      )
    })

    it(`toasts error with the reason on onDisconnect`, async () => {
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onDisconnect?.(`session-1`, `connection lost`)
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockToastError).toHaveBeenCalledWith(
        `Session disconnected`,
        expect.objectContaining({ description: `connection lost` })
      )
    })
  })

  describe(`onClose`, () => {
    it(`removes the session and clears activeSession when closing the active session`, async () => {
      const existing = makeOpenSessionData()
      mockGetOpenSessions.mockReturnValue(new Map([[`session-1`, existing]]))
      mockGetActiveSession.mockReturnValue(`session-1`)
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onClose?.(`session-1`, `sandbox-1`)
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockRemoveOpenSession).toHaveBeenCalledWith(`session-1`)
      expect(mockSetActiveSession).toHaveBeenCalledWith(null)
    })

    it(`removes the session but leaves activeSession untouched when closing a background session`, async () => {
      const existing = makeOpenSessionData()
      mockGetOpenSessions.mockReturnValue(new Map([[`session-1`, existing]]))
      mockGetActiveSession.mockReturnValue(`other-session`)
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onClose?.(`session-1`, `sandbox-1`)
        return Promise.resolve(`other-session`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockRemoveOpenSession).toHaveBeenCalledWith(`session-1`)
      expect(mockSetActiveSession).not.toHaveBeenCalledWith(null)
    })

    it(`does not call removeOpenSession when the session is not in openSessions`, async () => {
      mockGetOpenSessions.mockReturnValue(new Map())
      mockOpen.mockImplementation((_opts, handlers: TSessionEventHandlers) => {
        handlers.onClose?.(`session-1`, `sandbox-1`)
        return Promise.resolve(`session-1`)
      })

      await openSession({
        orgId: `org-1`,
        sandboxId: `sandbox-1`,
        projectId: `project-1`,
      })

      expect(mockRemoveOpenSession).not.toHaveBeenCalled()
    })
  })
})
