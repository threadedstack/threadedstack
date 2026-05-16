import type { TOpenSessionOpts, TTerminalEntry } from '@TTH/types'

import { toast } from 'sonner'
import { sessionService } from '@TTH/services/sessionService'
import {
  setOpenSession,
  getOpenSessions,
  getActiveSession,
  setActiveSession,
  removeOpenSession,
  setBackendSessions,
} from '@TTH/state/accessors'

export const getRawBuffer = (sessionId: string) => sessionService.getRawBuffer(sessionId)
export const getConnection = (sessionId: string) =>
  sessionService.getConnection(sessionId)

export const subscribeTerminalData = (sessionId: string, cb: (data: string) => void) =>
  sessionService.subscribeTerminalData(sessionId, cb)

export const subscribeEngineData = (sessionId: string, cb: (data: Uint8Array) => void) =>
  sessionService.subscribeEngineData(sessionId, cb)

export const getTerminal = (sessionId: string) => sessionService.getTerminal(sessionId)
export const setTerminal = (sessionId: string, entry: TTerminalEntry) =>
  sessionService.setTerminal(sessionId, entry)
export const deleteTerminal = (sessionId: string) =>
  sessionService.deleteTerminal(sessionId)

export const findSandboxForSession = (sessionId: string) =>
  sessionService.findSandboxForSession(sessionId)

export const clearStoredSessionsForSandbox = (sandboxId: string) =>
  sessionService.clearStoredSessionsForSandbox(sandboxId)

export const openSession = async (opts: TOpenSessionOpts) => {
  const sessionId = await sessionService.open(opts, {
    onSetup: (data) => {
      setOpenSession(data.sessionId, data)
    },
    onVisibilityChange: (sid, visibility) => {
      const existing = getOpenSessions().get(sid)
      if (existing) setOpenSession(sid, { ...existing, visibility })
    },
    onSessionsUpdated: (sandboxId, sessions) => {
      setBackendSessions(sandboxId, sessions)
    },
    onUserJoined: () => toast.info(`User joined your session`, { duration: 3000 }),
    onUserLeft: () => toast.info(`User left your session`, { duration: 3000 }),
    onSandboxStopping: () =>
      toast.info(`Sandbox is being stopped by another user`, { duration: 5000 }),
    onClose: (sid) => {
      const session = getOpenSessions().get(sid)
      if (session) removeOpenSession(sid)
      if (getActiveSession() === sid) setActiveSession(null)
    },
  })

  setActiveSession(sessionId)
  return sessionId
}
