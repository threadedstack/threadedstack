import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions } from '@TAF/state/accessors'

export type TFetchFunctionsResult = {
  functions?: Record<string, TDFunction>
  error?: Error
}

export const fetchFunctions = async (filters?: {
  projectId?: string
}): Promise<TFetchFunctionsResult> => {
  const resp = await functionsApi.list(filters)

  if (resp.error) {
    return { error: resp.error }
  }

  const functionsMap =
    resp.data?.reduce((acc: Record<string, TDFunction>, func: TDFunction) => {
      acc[func.id] = func
      return acc
    }, {}) || {}

  setFunctions(functionsMap)
  return { functions: functionsMap }
}
