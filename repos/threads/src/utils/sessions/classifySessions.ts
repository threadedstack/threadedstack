import type { TSandboxSession } from '@tdsk/domain'
import type { TOpenSession, TClassifiedSession } from '@TTH/types'

import { ESandboxSessionVisibility } from '@tdsk/domain'
import { CategoryOrder } from '@TTH/constants/sessions'

export type TLoadSandboxSessionsOpts = {
  orgId: string
  sandboxId: string
  projectId: string
}

/**
 * Pure classifier — derives TClassifiedSession[] from backend sessions + local state.
 * No side effects, no state access. Safe to call in useMemo.
 */
export const classifySessions = (
  backendSessions: TSandboxSession[],
  localSessions: TOpenSession[],
  currentUserId?: string
): TClassifiedSession[] => {
  const localIds = new Set(localSessions.map((s) => s.sessionId))
  const backendIds = new Set(backendSessions.map((s) => s.sessionId))
  const classified: TClassifiedSession[] = []

  for (const s of backendSessions) {
    const isOwn = s.userId === currentUserId
    const isConnected = localIds.has(s.sessionId)
    const { orgId: _org, instanceId: _inst, ...fields } = s

    if (isOwn) {
      classified.push({
        ...fields,
        category: isConnected ? `connected` : `disconnected`,
        hasShellSession: isConnected || !!fields.hasShellSession,
      })
    } else if (s.visibility === ESandboxSessionVisibility.public) {
      classified.push({
        ...fields,
        category: `shared`,
        hasShellSession: !!fields.hasShellSession,
      })
    }
  }

  for (const local of localSessions) {
    if (!backendIds.has(local.sessionId)) {
      classified.push({
        category: `connected`,
        hasShellSession: true,
        sessionId: local.sessionId,
        sandboxId: local.sandboxId,
        userId: currentUserId ?? ``,
        visibility: local.visibility,
        connectedAt: new Date().toISOString(),
      })
    }
  }

  classified.sort((a, b) => {
    const cat = CategoryOrder[a.category] - CategoryOrder[b.category]
    if (cat !== 0) return cat
    return new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
  })

  return classified
}
