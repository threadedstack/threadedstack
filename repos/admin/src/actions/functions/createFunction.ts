import type { Function as TDFunction } from '@tdsk/domain'

import { functionsApi } from '@TAF/services'
import { setFunctions, getFunctions } from '@TAF/state/accessors'

export type TCreateFunctionInput = Omit<
  Partial<TDFunction>,
  `name` | `content` | `language` | `projectId`
> & {
  name: string
  content: string
  language: string
  projectId: string
}

export const createFunction = async (input: Partial<TDFunction>) => {
  const resp = await functionsApi.create(input)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update functions state with the new function
    const currentFunctions = getFunctions() || {}
    setFunctions({ ...currentFunctions, [resp.data.id]: resp.data })
  }

  return resp
}
