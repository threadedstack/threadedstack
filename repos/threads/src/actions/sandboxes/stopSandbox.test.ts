import type { TOpenSession } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ESandboxSessionVisibility } from '@tdsk/domain'

const mockStop = vi.fn()
const mockSessions = vi.fn()
const mockCloseSession = vi.fn()
const mockGetSessionsForSandbox = vi.fn()

vi.mock(`@TTH/services/sandboxApi`, () => ({
  sandboxApi: {
    stop: (...args: unknown[]) => mockStop(...args),
    sessions: (...args: unknown[]) => mockSessions(...args),
  },
}))

vi.mock(`@TTH/actions/sessions`, () => ({
  closeSession: (...args: unknown[]) => mockCloseSession(...args),
}))

vi.mock(`@TTH/state/accessors`, () => ({
  getSessionsForSandbox: (...args: unknown[]) => mockGetSessionsForSandbox(...args),
}))

import { stopSandbox } from './stopSandbox'

const makeSession = (overrides: Partial<TOpenSession> = {}): TOpenSession => ({
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

describe(`stopSandbox`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`stopAll: true`, () => {
    it(`closes every local session for the sandbox after a successful stop`, async () => {
      mockStop.mockResolvedValue({ data: { success: true } })
      const sessions = [
        makeSession({ sessionId: `session-1` }),
        makeSession({ sessionId: `session-2` }),
      ]
      mockGetSessionsForSandbox.mockReturnValue(sessions)

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
        stopAll: true,
      })

      expect(result).toEqual({ stopped: true })
      expect(mockGetSessionsForSandbox).toHaveBeenCalledWith(`sandbox-1`)
      expect(mockCloseSession).toHaveBeenCalledTimes(2)
      expect(mockCloseSession).toHaveBeenCalledWith(`session-1`, {
        preserveStorage: true,
      })
      expect(mockCloseSession).toHaveBeenCalledWith(`session-2`, {
        preserveStorage: true,
      })
    })

    it(`does not call closeSession when there are no local sessions for the sandbox`, async () => {
      mockStop.mockResolvedValue({ data: { success: true } })
      mockGetSessionsForSandbox.mockReturnValue([])

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
        stopAll: true,
      })

      expect(result).toEqual({ stopped: true })
      expect(mockCloseSession).not.toHaveBeenCalled()
    })

    it(`returns stopped: false with activeSessions and does not close any sessions on a 409 conflict`, async () => {
      mockStop.mockResolvedValue({
        error: {
          status: 409,
          details: { data: { activeSessions: [{ sessionId: `session-1` }] } },
        },
      })

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
        stopAll: true,
      })

      expect(result).toEqual({
        stopped: false,
        activeSessions: [{ sessionId: `session-1` }],
      })
      expect(mockCloseSession).not.toHaveBeenCalled()
      expect(mockGetSessionsForSandbox).not.toHaveBeenCalled()
    })

    it(`throws and does not close sessions when sandboxApi.stop returns a non-409 error`, async () => {
      mockStop.mockResolvedValue({ error: { status: 500, message: `boom` } })

      await expect(
        stopSandbox({
          orgId: `org-1`,
          projectId: `project-1`,
          sandboxId: `sandbox-1`,
          stopAll: true,
        })
      ).rejects.toEqual({ status: 500, message: `boom` })

      expect(mockCloseSession).not.toHaveBeenCalled()
    })
  })

  describe(`single-instance path (stopAll not set)`, () => {
    it(`closes local sessions for the sandbox after a successful stop (pre-existing behavior)`, async () => {
      const sessions = [
        makeSession({ sessionId: `session-1`, instanceId: `instance-1` }),
        makeSession({ sessionId: `session-2`, instanceId: `instance-1` }),
      ]
      mockGetSessionsForSandbox.mockReturnValue(sessions)
      mockStop.mockResolvedValue({ data: { success: true } })

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
        instanceId: `instance-1`,
      })

      expect(result).toEqual({ stopped: true })
      expect(mockCloseSession).toHaveBeenCalledTimes(2)
      expect(mockCloseSession).toHaveBeenCalledWith(`session-1`, {
        preserveStorage: true,
      })
      expect(mockCloseSession).toHaveBeenCalledWith(`session-2`, {
        preserveStorage: true,
      })
    })

    it(`resolves the instanceId via sandboxApi.sessions when no local session/instanceId is known`, async () => {
      mockGetSessionsForSandbox.mockReturnValue([])
      mockSessions.mockResolvedValue({
        data: [{ instanceId: `remote-instance-1` }],
      })
      mockStop.mockResolvedValue({ data: { success: true } })

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
      })

      expect(result).toEqual({ stopped: true })
      expect(mockStop).toHaveBeenCalledWith(
        `org-1`,
        `project-1`,
        `sandbox-1`,
        `remote-instance-1`,
        undefined,
        undefined
      )
    })

    it(`returns stopped: false with no activeSessions when no instanceId can be resolved`, async () => {
      mockGetSessionsForSandbox.mockReturnValue([])
      mockSessions.mockResolvedValue({ data: [] })

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
      })

      expect(result).toEqual({ stopped: false, activeSessions: [] })
      expect(mockStop).not.toHaveBeenCalled()
    })

    it(`returns stopped: false with activeSessions and does not close sessions on a 409 conflict`, async () => {
      const sessions = [makeSession({ sessionId: `session-1`, instanceId: `instance-1` })]
      mockGetSessionsForSandbox.mockReturnValue(sessions)
      mockStop.mockResolvedValue({
        error: {
          status: 409,
          details: { data: { activeSessions: [{ sessionId: `session-1` }] } },
        },
      })

      const result = await stopSandbox({
        orgId: `org-1`,
        projectId: `project-1`,
        sandboxId: `sandbox-1`,
        instanceId: `instance-1`,
      })

      expect(result).toEqual({
        stopped: false,
        activeSessions: [{ sessionId: `session-1` }],
      })
      expect(mockCloseSession).not.toHaveBeenCalled()
    })
  })
})
