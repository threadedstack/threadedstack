import { functionsApi } from '@TAF/services'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export type TDeleteFunctionOpts = {
  orgId: string
  projectId: string
  id: string
}

export type TDeleteFunctionResult = {
  success?: boolean
  error?: Error
}

export const deleteFunction = async (
  opts: TDeleteFunctionOpts
): Promise<TDeleteFunctionResult> => {
  const { orgId, projectId, id } = opts
  const resp = await functionsApi.delete(orgId, projectId, id)

  if (resp.error) return { error: resp.error }

  const current = getProjectFunctions(projectId) || {}
  const { [id]: removed, ...remaining } = current
  setProjectFunctions(projectId, remaining)

  return { success: true }
}
