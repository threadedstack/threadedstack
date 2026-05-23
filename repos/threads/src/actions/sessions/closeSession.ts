import { sessionService } from '@TTH/services/sessionService'
import { resetEditor } from '@TTH/actions/editor/resetEditor'
import { clearFileTreeSyncTimers } from '@TTH/actions/editor/handleFileTreeChanged'
import {
  getActiveSession,
  setActiveSession,
  removeOpenSession,
} from '@TTH/state/accessors'

export const closeSession = (sessionId: string, opts?: { preserveStorage?: boolean }) => {
  sessionService.close(sessionId, opts)
  removeOpenSession(sessionId)
  if (getActiveSession() === sessionId) {
    setActiveSession(null)
    clearFileTreeSyncTimers()
    resetEditor()
  }
}
