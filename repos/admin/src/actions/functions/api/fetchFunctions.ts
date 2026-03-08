import { functionsApi } from '@TAF/services'
import { setFunctions } from '@TAF/actions/functions/local/setFunctions'

export type TFetchFunctionsOpts = {
  orgId: string
  projectId: string
}

export const fetchFunctions = async (opts: TFetchFunctionsOpts) => {
  const { orgId, projectId } = opts
  const resp = await functionsApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }

  resp.data && setFunctions(projectId, resp.data)

  return resp
}
