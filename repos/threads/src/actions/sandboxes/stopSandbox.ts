import type { TStopSandboxResult } from '@TTH/types'

import { closeSession } from '@TTH/actions/sessions'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { getSessionsForSandbox } from '@TTH/state/accessors'

type TStopSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
  force?: boolean
}

export const stopSandbox = async (
  opts: TStopSandboxOpts
): Promise<TStopSandboxResult> => {
  const { sandboxId, orgId, projectId, force } = opts
  const sessions = getSessionsForSandbox(sandboxId)

  let podName = sessions[0]?.podName
  if (!podName) {
    const { data: remoteSessions, error: sessError } = await sandboxApi.sessions(
      orgId,
      projectId,
      sandboxId
    )
    if (sessError)
      throw new Error(`Failed to check sandbox sessions: ${sessError.message}`)
    podName = remoteSessions?.[0]?.podName
    if (!podName) return { stopped: false, activeSessions: [] }
  }

  const resp = await sandboxApi.stop(orgId, projectId, sandboxId, podName, force)

  if (resp.error?.status === 409) {
    const body = resp.error?.details as Record<string, any> | undefined
    return {
      stopped: false,
      activeSessions: body?.data?.activeSessions ?? [],
    }
  }

  if (resp.error) throw resp.error

  for (const session of sessions) {
    closeSession(session.sessionId, { preserveStorage: true })
  }

  return { stopped: true }
}
