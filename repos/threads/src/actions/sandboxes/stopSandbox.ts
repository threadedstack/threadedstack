import type { TStopSandboxResult, TSandboxActionOpts } from '@TTH/types'

import { closeSession } from '@TTH/actions/sessions'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { getSessionsForSandbox } from '@TTH/state/accessors'

type TStopSandboxOpts = TSandboxActionOpts & {
  force?: boolean
  stopAll?: boolean
}

export const stopSandbox = async (
  opts: TStopSandboxOpts
): Promise<TStopSandboxResult> => {
  const { orgId, force, stopAll, projectId, sandboxId, instanceId: inId } = opts

  if (stopAll) {
    const resp = await sandboxApi.stop(
      orgId,
      projectId,
      sandboxId,
      undefined,
      force,
      true
    )

    if (resp.error?.status === 409) {
      const body = resp.error?.details as Record<string, any> | undefined
      return { stopped: false, activeSessions: body?.data?.activeSessions ?? [] }
    }
    if (resp.error) throw resp.error
    return { stopped: true }
  }

  const sessions = getSessionsForSandbox(sandboxId)

  let instanceId = inId || sessions[0]?.instanceId
  if (!instanceId) {
    const { data: remoteSessions, error: sessError } = await sandboxApi.sessions(
      orgId,
      projectId,
      sandboxId
    )

    if (sessError)
      throw new Error(`Failed to check sandbox sessions: ${sessError.message}`)

    instanceId = remoteSessions?.[0]?.instanceId
    if (!instanceId) return { stopped: false, activeSessions: [] }
  }

  const resp = await sandboxApi.stop(
    orgId,
    projectId,
    sandboxId,
    instanceId,
    force,
    stopAll
  )

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
