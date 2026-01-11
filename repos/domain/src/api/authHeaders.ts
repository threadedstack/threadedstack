import type { TAuthHeaderObj } from '@TDM/types'

import { get } from '@keg-hub/jsutils/get'
import { exists } from '@keg-hub/jsutils/exists'
import { AuthHeaders } from '@TDM/constants/values'

type TClientReq = {
  [key: string]: any
  setHeader?: (key: string, value?: string) => any
}

type TReq = {
  header?: (key: string) => string
}

export const setAuthHeaders = (pxReq: TClientReq, req: Record<string, any>) => {
  Object.entries(AuthHeaders).forEach(([loc, key]) => {
    const val = get(req, loc)
    exists(val) && pxReq?.setHeader?.(key, val)
  })
}

export const fromAuthHeaders = (req: TReq) => {
  return Object.entries(AuthHeaders).reduce((acc, [loc, key]) => {
    const name = loc.split(`.`).pop()
    acc[name] = req?.header?.(key)
    return acc
  }, {} as TAuthHeaderObj)
}
