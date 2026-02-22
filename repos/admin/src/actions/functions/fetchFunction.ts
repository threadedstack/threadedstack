import type { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TFetchFunctionOpts = {
  orgId: string
  projectId: string
  id: string
}

export type TFetchFunctionResult = {
  function?: FunctionModel
  error?: Error
}

export const fetchFunction = async (
  opts: TFetchFunctionOpts
): Promise<TFetchFunctionResult> => {
  const { orgId, projectId, id } = opts
  const resp = await functionsApi.get(orgId, projectId, id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    const current = getProjectFunctions(projectId) || {}
    setProjectFunctions(projectId, { ...current, [resp.data.id]: resp.data })
  }

  return { function: resp.data }
}
