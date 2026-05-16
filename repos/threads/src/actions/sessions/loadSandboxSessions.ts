import type { TSandboxSession } from '@tdsk/domain'

import { sandboxApi } from '@TTH/services/sandboxApi'

export type TLoadSandboxSessionsOpts = {
  orgId: string
  sandboxId: string
  projectId: string
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
