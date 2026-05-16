import { sessionService } from '@TTH/services/sessionService'
import {
  removeOpenSession,
  getActiveSession,
  setActiveSession,
} from '@TTH/state/accessors'

export const closeSession = (sessionId: string, opts?: { preserveStorage?: boolean }) => {
  sessionService.close(sessionId, opts)
  removeOpenSession(sessionId)
  if (getActiveSession() === sessionId) setActiveSession(null)
}
