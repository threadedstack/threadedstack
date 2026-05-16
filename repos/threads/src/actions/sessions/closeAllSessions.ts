import { sessionService } from '@TTH/services/sessionService'
import { resetOpenSessions, setActiveSession } from '@TTH/state/accessors'

export const closeAllSessions = () => {
  sessionService.closeAll()
  resetOpenSessions()
  setActiveSession(null)
}
