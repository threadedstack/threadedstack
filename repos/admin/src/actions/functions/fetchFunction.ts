import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TFetchFunctionResult = {
  function?: TDFunction
  error?: Error
}

export const fetchFunction = async (id: string): Promise<TFetchFunctionResult> => {
  const resp = await functionsApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update functions state with the fetched function
    const currentFunctions = getFunctions() || {}
    setFunctions({ ...currentFunctions, [resp.data.id]: resp.data })
  }

  return { function: resp.data }
}
