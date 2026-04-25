import { sandboxApi } from '@TTH/services/sandboxApi'
import { setBackendSessions } from '@TTH/state/accessors'

export type TFetchSandboxSessionsOpts = {
  orgId: string
  sandboxId: string
  projectId: string
}

export const fetchSandboxSessions = async (opts: TFetchSandboxSessionsOpts) => {
  const { orgId, sandboxId, projectId } = opts
  const resp = await sandboxApi.sessions(orgId, projectId, sandboxId)

  if (resp.data) setBackendSessions(sandboxId, resp.data)

  return resp
}
