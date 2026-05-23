import { sessionService } from '@TTH/services/sessionService'
import { resetEditor } from '@TTH/actions/editor/resetEditor'
import { resetOpenSessions, setActiveSession } from '@TTH/state/accessors'
import { clearFileTreeSyncTimers } from '@TTH/actions/editor/handleFileTreeChanged'

export const closeAllSessions = () => {
  sessionService.closeAll()
  resetOpenSessions()
  setActiveSession(null)
  clearFileTreeSyncTimers()
  resetEditor()
}
