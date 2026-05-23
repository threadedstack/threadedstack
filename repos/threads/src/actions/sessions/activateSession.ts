import { resetEditor } from '@TTH/actions/editor/resetEditor'
import { loadDirectory } from '@TTH/actions/editor/loadDirectory'
import { getActiveSession, getOpenSessions, setActiveSession } from '@TTH/state/accessors'

export const activateSession = (sessionId: string) => {
  const prev = getActiveSession()
  setActiveSession(sessionId)
  if (prev === sessionId) return

  resetEditor()
  const session = getOpenSessions().get(sessionId)
  session?.workdir && loadDirectory(session.workdir, sessionId)
}
