import {
  getOpenSessions,
  removeOpenSession,
  getActiveSession,
  setActiveSession,
} from '@TTH/state/accessors'
import { removeStoredSession } from '@TTH/utils/sessionStorage'
import { getConnection } from './openSession'

export const closeSession = (sessionId: string, opts?: { preserveStorage?: boolean }) => {
  const ws = getConnection(sessionId)
  if (ws) ws.close()

  const session = getOpenSessions().get(sessionId)
  removeOpenSession(sessionId)
  if (getActiveSession() === sessionId) setActiveSession(null)
  if (!opts?.preserveStorage && session) {
    removeStoredSession(session.sandboxId, sessionId)
  }
}
