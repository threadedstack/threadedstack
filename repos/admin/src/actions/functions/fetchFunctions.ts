import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions } from '@TAF/state/accessors'

export type TFetchFunctionsOpts = {
  orgId: string
  projectId: string
}

export type TFetchFunctionsResult = {
  functions?: Record<string, TDFunction>
  error?: Error
}

export const fetchFunctions = async (
  opts: TFetchFunctionsOpts
): Promise<TFetchFunctionsResult> => {
  const { orgId, projectId } = opts
  const resp = await functionsApi.list(orgId, projectId)

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
