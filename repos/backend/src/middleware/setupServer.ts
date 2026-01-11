import type { Router } from 'express'
import type { TApp } from '@tdsk/domain'

import cors from 'cors'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

/**
 * Configures the express app and router
 * Should be called after request logger, but before other middleware
 */
export const setupServer = (app: TApp, router: Router) => {
  //app.disable(`etag`)
  //app.set(`trust proxy`, 1)
  app.disable(`x-powered-by`)

  const origins = ensureArr(app.locals.config.server.origins)
  app.use(
    cors({
      credentials: true,
      origin: (url, cb) => cb(null, origins.includes(`*`) || origins.includes(url)),
    })
  )

  // Add the Router that contains all the configured endpoints
  app.use(router)
}
