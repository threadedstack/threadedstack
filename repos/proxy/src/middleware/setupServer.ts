import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import cors from 'cors'
import express from 'express'

/**
 * Configures the express app and router
 * Should be called after request logger, but before other middleware
 */
export const setupServer = (app: TProxyApp, router: Router) => {
  app.disable(`x-powered-by`)

  // CORS middleware
  app.use(
    cors({
      credentials: true,
      origin: app.locals.config.server.origins,
    })
  )

  // Body parsing middleware
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Add the AppRouter that contains all the configured endpoints
  app.use(router)
}
