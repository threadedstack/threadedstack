import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertFunction } from '@TAF/actions/functions/local/upsertFunction'

export type TUpdateFunctionOpts = {
  orgId: string
  projectId: string
  id: string
  data: Partial<FunctionModel>
}

export const updateFunction = async (opts: TUpdateFunctionOpts) => {
  const { orgId, projectId, id, data } = opts
  const resp = await functionsApi.update(orgId, projectId, id, data)

  if (resp.error) return { error: resp.error }

  resp.data && upsertFunction(projectId, resp.data)
  resp.data && query.upsertListCache(functionsApi.cache.list(orgId, projectId), resp.data)
  resp.data && query.updateDetailCache(functionsApi.cache.detail(id), resp.data)

  return resp
}
