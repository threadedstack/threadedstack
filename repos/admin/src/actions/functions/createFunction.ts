import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TCreateFunctionOpts = {
  orgId: string
  projectId: string
  data: Partial<FunctionModel>
}

export const createFunction = async (opts: TCreateFunctionOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await functionsApi.create(orgId, projectId, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const current = getProjectFunctions(projectId) || {}
    setProjectFunctions(projectId, { ...current, [resp.data.id]: resp.data })
  }

  return resp
}
