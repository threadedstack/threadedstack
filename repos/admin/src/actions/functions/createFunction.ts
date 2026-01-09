import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TCreateFunctionInput = {
  name: string
  repoId: string
  code: string
  runtime?: string
  description?: string
  config?: Record<string, any>
}

export type TCreateFunctionResult = {
  function?: TDFunction
  error?: Error
}

export const createFunction = async (
  input: TCreateFunctionInput
): Promise<TCreateFunctionResult> => {
  const resp = await functionsApi.create(input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update functions state with the new function
    const currentFunctions = getFunctions() || {}
    setFunctions({ ...currentFunctions, [resp.data.id]: resp.data })
  }

  return { function: resp.data }
}
