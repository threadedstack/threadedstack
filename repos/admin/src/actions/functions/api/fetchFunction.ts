import { functionsApi } from '@TAF/services'
import { upsertFunction } from '@TAF/actions/functions/local/upsertFunction'

export type TFetchFunctionOpts = {
  orgId: string
  projectId: string
  id: string
}

export const fetchFunction = async (opts: TFetchFunctionOpts) => {
  const { orgId, projectId, id } = opts
  const resp = await functionsApi.get(orgId, projectId, id)

  if (resp.error) return { error: resp.error }

  resp.data && upsertFunction(projectId, resp.data)
  return resp
}
