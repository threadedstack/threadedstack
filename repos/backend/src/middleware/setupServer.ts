import type { Router } from 'express'
import type { TApp, TRouter } from '@tdsk/domain'

import cors from 'cors'
import { behindLBProxy } from '@tdsk/domain'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

/**
 * Configures the express app and router
 * Should be called after request logger, but before other middleware
 */
export const setupServer = (app: TApp, router: TRouter) => {
  //app.disable(`etag`)
  //app.set(`trust proxy`, 1)
  app.disable(`x-powered-by`)

  const origins = ensureArr(app.locals.config.server.origins)
  !behindLBProxy() &&
    app.use(
      cors({
        credentials: true,
        origin: origins.includes(`*`) ? `*` : origins,
      })
    )

  // Add the Router that contains all the configured endpoints
  app.use(router as unknown as Router)
}
