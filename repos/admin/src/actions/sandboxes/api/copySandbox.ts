import { sandboxApi } from '@TAF/services'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

type TCopySandboxOpts = {
  orgId: string
  id: string
  name: string
  projectId?: string
}

export const copySandbox = async (opts: TCopySandboxOpts) => {
  const { orgId, id, name, projectId } = opts
  const resp = await sandboxApi.copy(orgId, id, name)

  if (resp.error) return { error: resp.error }

  const contextKey = projectId || `org`
  resp.data && upsertSandbox(contextKey, resp.data)

  return resp
}
