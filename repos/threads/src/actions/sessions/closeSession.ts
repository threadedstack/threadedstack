import {
  removeOpenSession,
  getActiveSession,
  setActiveSession,
} from '@TTH/state/accessors'
import { getConnection } from './openSession'

export const closeSession = (sandboxId: string, opts?: { preserveStorage?: boolean }) => {
  const ws = getConnection(sandboxId)
  if (ws) ws.close()
  removeOpenSession(sandboxId)
  if (getActiveSession() === sandboxId) setActiveSession(null)
  if (!opts?.preserveStorage) sessionStorage.removeItem(`shell_${sandboxId}`)
}
