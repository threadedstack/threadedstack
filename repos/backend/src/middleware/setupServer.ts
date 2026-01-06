import type { Router } from 'express'
import type { TApp } from '@tdsk/domain'

import cors from 'cors'
import { database } from '@tdsk/database'

/**
 * Configures the express app and router
 * Should be called after request logger, but before other middleware
 */
export const setupServer = (app:TApp, router:Router) => {

  app.locals.db = database(app.locals.config.database)

  app.disable(`x-powered-by`)

  app.use(
    cors({
      credentials: true,
      origin: app.locals.config.server.origins.join(','),
    })
  )

  // Add the AppRoute that contains all the configured endpoints
  app.use(router)
}
