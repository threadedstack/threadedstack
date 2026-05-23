import type { TFileCtx } from '@TTH/types'

import { getOrgId, getActiveSession, getOpenSessions } from '@TTH/state/accessors'

export const getFileCtx = (overrideSessionId?: string): TFileCtx | null => {
  const orgId = getOrgId()
  const sessionId = overrideSessionId || getActiveSession()
  if (!orgId || !sessionId) return null

  const session = getOpenSessions().get(sessionId)
  if (!session) return null
  if (!session.projectId || !session.sandboxId || !session.instanceId) return null

  return {
    orgId,
    projectId: session.projectId,
    sandboxId: session.sandboxId,
    instanceId: session.instanceId,
  }
}
