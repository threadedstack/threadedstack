import { sandboxApi } from '@TAF/services'
import { setSandboxes } from '@TAF/actions/sandboxes/local/setSandboxes'

export type TFetchSandboxesOpts = {
  orgId: string
  projectId?: string
}

export const fetchSandboxes = async (opts: TFetchSandboxesOpts) => {
  const { orgId, projectId } = opts
  const resp = await sandboxApi.list(orgId, projectId)

  if (resp.error) return { error: resp.error }

  const contextKey = projectId || `org`
  resp.data && setSandboxes(contextKey, resp.data)

  return resp
}
