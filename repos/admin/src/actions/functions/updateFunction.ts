import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

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

  if (resp.data) {
    const current = getProjectFunctions(projectId) || {}
    setProjectFunctions(projectId, { ...current, [resp.data.id]: resp.data })
  }

  return resp
}
