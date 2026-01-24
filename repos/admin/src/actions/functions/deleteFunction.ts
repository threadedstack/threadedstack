import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TDeleteFunctionResult = {
  success?: boolean
  error?: Error
}

export const deleteFunction = async (id: string): Promise<TDeleteFunctionResult> => {
  const resp = await functionsApi.delete(id)

  if (resp.error) return { error: resp.error }

  // Remove function from state
  const currentFunctions = getFunctions() || {}
  const { [id]: removed, ...remainingFunctions } = currentFunctions
  setFunctions(remainingFunctions)

  return { success: true }
}
