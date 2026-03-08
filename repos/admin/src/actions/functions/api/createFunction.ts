import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { upsertFunction } from '@TAF/actions/functions/local/upsertFunction'

export type TCreateFunctionOpts = {
  orgId: string
  projectId: string
  data: Partial<FunctionModel>
}

export const createFunction = async (opts: TCreateFunctionOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await functionsApi.create(orgId, projectId, data)

  if (resp.error) return { error: resp.error }

  resp.data && upsertFunction(projectId, resp.data)
  return resp
}
