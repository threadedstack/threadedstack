import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TUpdateFunctionInput = {
  name?: string
  code?: string
  runtime?: string
  description?: string
  config?: Record<string, any>
}

export type TUpdateFunctionResult = {
  function?: TDFunction
  error?: Error
}

export const updateFunction = async (
  id: string,
  input: TUpdateFunctionInput
): Promise<TUpdateFunctionResult> => {
  const resp = await functionsApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update functions state with the updated function
    const currentFunctions = getFunctions() || {}
    setFunctions({ ...currentFunctions, [resp.data.id]: resp.data })
  }

  return { function: resp.data }
}
