import { sandboxApi } from '@TTH/services/sandboxApi'
import { getOpenSessions } from '@TTH/state/accessors'
import { closeSession } from '@TTH/actions/sessions'

export type TStopSandboxOpts = {
  sandboxId: string
  orgId: string
}

export const stopSandbox = async (opts: TStopSandboxOpts): Promise<boolean> => {
  const { sandboxId, orgId } = opts
  const session = getOpenSessions().get(sandboxId)
  if (!session) return false

  const { projectId, podName } = session

  try {
    const resp = await sandboxApi.stop(orgId, projectId, sandboxId, podName)
    return !resp.error
  } finally {
    closeSession(sandboxId, { preserveStorage: true })
  }
}
