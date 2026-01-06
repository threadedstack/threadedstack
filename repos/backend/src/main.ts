import type { TABConfig } from '@TBE/types'

import { app } from '@TBE/server/app'
import { router } from '@TBE//server/router'
import { initServer } from '@TBE/server/server'
import { setupProxy } from '@TBE/middleware/setupProxy'
import { setupServer } from '@TBE/middleware/setupServer'
import { setupLoggerReq, setupLoggerErr } from '@tdsk/logger'
import { setupEndpoints } from '@TBE/middleware/setupEndpoints'
import { setupErrorHandler } from '@TBE/middleware/setupErrorHandler'

export const main = (config: TABConfig) => {
  app.locals.config = config
  setupLoggerReq(app)
  setupServer(app, router)
  setupEndpoints(router, config)
  setupProxy(app, router)
  setupLoggerErr(app)
  setupErrorHandler(app)

  const server = initServer()

  return {
    app,
    server,
  }
}
