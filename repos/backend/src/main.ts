import type { TBEConfig } from '@TBE/types'

import { app } from '@TBE/server/app'
import { router } from '@TBE/server/router'
import { initServer } from '@TBE/server/server'
import { setupProxy } from '@TBE/middleware/setupProxy'
import { setupServer } from '@TBE/middleware/setupServer'
import { setupLogger } from '@TBE/middleware/setupLogger'
import { EmailService } from '@TBE/services/email'
import { PolarService } from '@TBE/services/payments/polar'
import { setupDatabase } from '@TBE/middleware/setupDatabase'
import { setupEndpoints } from '@TBE/middleware/setupEndpoints'
import { setupErrorHandler } from '@TBE/middleware/setupErrorHandler'

export const main = (config: TBEConfig) => {
  app.locals.config = config
  app.locals.email = new EmailService(config.email)
  app.locals.payments = new PolarService(config.payments)

  setupLogger(app)
  setupServer(app, router)
  setupDatabase(app)
  setupEndpoints(app, router)
  //setupProxy(app, router)
  setupErrorHandler(app)

  const server = initServer()

  return {
    app,
    server,
  }
}
