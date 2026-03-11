import { sandboxApi } from '@TAF/services'
import { setSandboxes } from '@TAF/actions/sandboxes/local/setSandboxes'

export type TFetchSandboxesOpts = {
  orgId: string
}

export const fetchSandboxes = async (opts: TFetchSandboxesOpts) => {
  const { orgId } = opts
  const resp = await sandboxApi.list(orgId)

  if (resp.error) return { error: resp.error }

  resp.data && setSandboxes(resp.data)
  return resp
}
