import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TUpdateFunctionOpts = {
  orgId: string
  projectId: string
  id: string
  data: Partial<TDFunction>
}

export const updateFunction = async (opts: TUpdateFunctionOpts) => {
  const { orgId, projectId, id, data } = opts
  const resp = await functionsApi.update(orgId, projectId, id, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update functions state with the updated function
    const currentFunctions = getFunctions() || {}
    setFunctions({ ...currentFunctions, [resp.data.id]: resp.data })
  }

  return resp
}
