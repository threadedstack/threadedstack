import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TCreateFunctionOpts = {
  orgId: string
  projectId: string
  data: Partial<TDFunction>
}

export const createFunction = async (opts: TCreateFunctionOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await functionsApi.create(orgId, projectId, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update functions state with the new function
    const currentFunctions = getFunctions() || {}
    setFunctions({ ...currentFunctions, [resp.data.id]: resp.data })
  }

  return resp
}
