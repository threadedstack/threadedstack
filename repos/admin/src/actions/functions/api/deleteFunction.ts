import { functionsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeFunction } from '@TAF/actions/functions/local/removeFunction'

export type TDeleteFunctionOpts = {
  id: string
  orgId: string
  projectId: string
}

export const deleteFunction = async (opts: TDeleteFunctionOpts) => {
  const { orgId, projectId, id } = opts
  const resp = await functionsApi.delete(orgId, projectId, id)

  if (resp.error) return { error: resp.error }

  removeFunction(projectId, id)
  query.removeFromListCache(functionsApi.cache.list(orgId, projectId), id)
  query.client.removeQueries({ queryKey: functionsApi.cache.detail(id) })

  return { success: resp.data }
}
