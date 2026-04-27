import { closeSession } from '@TTH/actions/sessions'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { getSessionsForSandbox } from '@TTH/state/accessors'

export type TStopSandboxOpts = {
  sandboxId: string
  orgId: string
}

export const stopSandbox = async (opts: TStopSandboxOpts): Promise<boolean> => {
  const { sandboxId, orgId } = opts
  const sessions = getSessionsForSandbox(sandboxId)
  if (sessions.length === 0) return false

  const { projectId, podName } = sessions[0]

  try {
    const resp = await sandboxApi.stop(orgId, projectId, sandboxId, podName)
    return !resp.error
  } finally {
    for (const session of sessions) {
      closeSession(session.sessionId, { preserveStorage: true })
    }
  }
}
