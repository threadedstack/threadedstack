import { closeAllConnections } from '@TTH/actions/sessions/openSession'
import { disposeTerminal } from '@TTH/components/Terminal/TerminalView'
import { getOpenSessions, setActiveSession } from '@TTH/state/accessors'

export const closeAllSessions = () => {
  const sessions = getOpenSessions()
  for (const sessionId of sessions.keys()) {
    try {
      disposeTerminal(sessionId)
    } catch (err) {
      console.warn(`[closeAllSessions] disposeTerminal failed for ${sessionId}:`, err)
    }
  }
  closeAllConnections()
  setActiveSession(null)
}
