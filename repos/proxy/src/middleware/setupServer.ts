import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import cors from 'cors'
import helmet from 'helmet'
import express from 'express'
import { behindLBProxy } from '@tdsk/domain'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

/**
 * Configures the express app and router
 * Should be called after request logger, but before other middleware
 */
export const setupServer = (app: TProxyApp, router: Router) => {
  //app.disable(`etag`)
  //app.set(`trust proxy`, 1)
  app.disable(`x-powered-by`)
  app.use(helmet())
  const origins = ensureArr(app.locals.config.server.origins)

  !behindLBProxy() &&
    app.use(
      cors({
        origin: origins.includes(`*`) ? `*` : origins,
      })
    )

  app.use(express.urlencoded({ extended: true }))

  app.use(router)
}
