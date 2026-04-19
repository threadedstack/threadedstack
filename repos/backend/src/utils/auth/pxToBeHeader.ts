import type { TRequest } from '@tdsk/domain'

import { timingSafeEqual } from 'crypto'
import { exists } from '@keg-hub/jsutils/exists'

export const pxToBeHeader = (req: TRequest) => {
  const { config } = req.app?.locals

  if (!exists(config.proxy.headerValue)) return

  const validate = req.header(config.proxy.headerKey)
  if (!validate || typeof validate !== 'string')
    throw new Error(`Invalid proxy validation`)

  const expected = Buffer.from(config.proxy.headerValue as string)
  const received = Buffer.from(validate)

  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new Error(`Invalid proxy validation`)
}
