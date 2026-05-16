import type { TAuthHeaderObj } from '@TDM/types'

import { get } from '@keg-hub/jsutils/get'
import { exists } from '@keg-hub/jsutils/exists'
import { AuthHeaders } from '@TDM/constants/values'

type TClientReq = {
  [key: string]: any
  setHeader?: (key: string, value?: string) => any
  removeHeader?: (key: string) => void
}

type TReq = {
  header?: (key: string) => string
}

export const setAuthHeaders = (pxReq: TClientReq, req: Record<string, any>) => {
  Object.entries(AuthHeaders).forEach(([loc, key]) => {
    pxReq?.removeHeader?.(key)
    const val = get(req, loc)
    exists(val) && pxReq?.setHeader?.(key, val)
  })
}

export const fromAuthHeaders = (req: TReq): Partial<TAuthHeaderObj> => {
  return Object.entries(AuthHeaders).reduce(
    (acc, [loc, key]) => {
      const name = loc.split(`.`).pop()
      acc[name] = req?.header?.(key)
      return acc
    },
    {} as Partial<TAuthHeaderObj>
  )
}

export const getAuthHeader = (req: TReq, name: string) => {
  return req?.header?.(AuthHeaders[`user.${name}`])
}
