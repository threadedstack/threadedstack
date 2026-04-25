import { setActiveSession } from '@TTH/state/accessors'

export const activateSession = (sessionId: string) => {
  setActiveSession(sessionId)
}
