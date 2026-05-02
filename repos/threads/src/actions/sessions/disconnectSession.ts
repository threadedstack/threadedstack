import { getOpenSessions } from '@TTH/state/accessors'
import { closeSession } from './closeSession'

export const disconnectSession = (
  sessionId: string
): { sandboxId: string; projectId: string } | undefined => {
  const session = getOpenSessions().get(sessionId)
  if (!session) return undefined

  const { sandboxId, projectId } = session

  closeSession(sessionId, { preserveStorage: true })

  return { sandboxId, projectId }
}
