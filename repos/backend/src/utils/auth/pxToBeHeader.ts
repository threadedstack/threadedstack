import type { TRequest } from '@tdsk/domain'

import { exists } from '@keg-hub/jsutils/exists'

export const pxToBeHeader = (req: TRequest) => {
  const { config } = req.app?.locals

  if (!exists(config.proxy.headerValue)) return

  const validate = req.header(config.proxy.headerKey)
  if (config.proxy.headerValue !== validate) throw new Error(`Invalid proxy validation`)
}
