import type { TOpenSession, TClassifiedSession } from '@TTH/types'
import type { TSandboxSession } from '@tdsk/domain'

import { ESandboxSessionVisibility } from '@tdsk/domain'
import { sandboxApi } from '@TTH/services/sandboxApi'

export type TLoadSandboxSessionsOpts = {
  orgId: string
  sandboxId: string
  projectId: string
}

const categoryOrder = { connected: 0, disconnected: 1, shared: 2 } as const

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
    const { orgId: _org, podName: _pod, ...fields } = s

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
        userId: currentUserId ?? ``,
        sessionId: local.sessionId,
        sandboxId: local.sandboxId,
        connectedAt: new Date().toISOString(),
        visibility: local.visibility,
        category: `connected`,
        hasShellSession: true,
      })
    }
  }

  classified.sort((a, b) => {
    const cat = categoryOrder[a.category] - categoryOrder[b.category]
    if (cat !== 0) return cat
    return new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
  })

  return classified
}

/**
 * Fetches raw sessions from the backend API.
 * Returns TSandboxSession[] for the component to store and classify via useMemo.
 */
export const fetchSandboxSessions = async (
  opts: TLoadSandboxSessionsOpts
): Promise<{ data?: TSandboxSession[]; error?: string }> => {
  try {
    const { orgId, sandboxId, projectId } = opts
    const resp = await sandboxApi.sessions(orgId, projectId, sandboxId)

    if (resp.error || !resp.data)
      return { error: resp.error?.message ?? `Failed to load sessions` }

    return { data: resp.data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : `Failed to load sessions` }
  }
}
