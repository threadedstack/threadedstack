import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

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

  // Remove function from state
  const currentFunctions = getFunctions() || {}
  const { [id]: removed, ...remainingFunctions } = currentFunctions
  setFunctions(remainingFunctions)

  return { success: true }
}
