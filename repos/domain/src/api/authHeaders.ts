import type { TAuthHeaderObj, TRequest } from '@TDM/types'
import type { ClientRequest, IncomingMessage } from 'http'

import { get } from '@keg-hub/jsutils/get'
import { exists } from '@keg-hub/jsutils/exists'
import { AuthHeaders } from '@TDM/constants/values'

export const setAuthHeaders = (pxReq: ClientRequest, req: TRequest | IncomingMessage) => {
  Object.entries(AuthHeaders).forEach(([loc, key]) => {
    const val = get(req, loc)
    exists(val) && pxReq.setHeader(key, val)
  })
}

export const fromAuthHeaders = (req: TRequest) => {
  return Object.entries(AuthHeaders).reduce((acc, [loc, key]) => {
    const name = loc.split(`.`).pop()
    acc[name] = req.header(key)
    return acc
  }, {} as TAuthHeaderObj)
}
