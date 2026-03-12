import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { exists } from '@keg-hub/jsutils/exists'

/**
 * Pre-warm interceptor middleware
 * Checks for X-Threaded-Stack-Prewarm header and returns early if present
 * This triggers certificate generation in Caddy before the actual user request
 */
export const prewarm = (req: Request, res: Response, next: NextFunction) => {
  const { config } = req.app.locals
  const prewarmHeader = req.headers[config.domains.prewarmHeader]

  if (!exists(prewarmHeader)) return next()

  res.status(200).json({
    status: `warmed`,
    message: `Certificate generation triggered`,
  })
}

export const setupPrewarm = (app: TProxyApp) => {
  app.use(prewarm)
}
