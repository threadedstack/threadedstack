import type { TBEConfig } from '@TBE/types'

import { app } from '@TBE/server/app'
import { router } from '@TBE/server/router'
import { signals } from '@TBE/utils/signals'
import { initServer } from '@TBE/server/server'
import { EmailService } from '@TBE/services/email'
import { setupServer } from '@TBE/middleware/setupServer'
import { setupRateLimit } from '@TBE/middleware/rateLimit'
import { setupLogger } from '@TBE/middleware/setupLogger'
import { setupSandbox } from '@TBE/middleware/setupSandbox'
import { setupDatabase } from '@TBE/middleware/setupDatabase'
import { setupEndpoints } from '@TBE/middleware/setupEndpoints'
import { setupScheduler } from '@TBE/middleware/setupScheduler'
import { setupSandboxProxy } from '@TBE/middleware/sandboxProxy'
import { PaymentsService } from '@TBE/services/payments/payments'
import { setupErrorHandler } from '@TBE/middleware/setupErrorHandler'

export const main = async (config: TBEConfig) => {
  app.locals.config = config
  app.locals.email = new EmailService(config.email)
  app.locals.payments = new PaymentsService(config.payments)

  setupLogger(app)
  setupServer(app, router)
  setupRateLimit(app)
  setupDatabase(app)

  await setupSandbox(app)
  setupSandboxProxy(app)

  setupEndpoints(app, router)
  setupErrorHandler(app)

  const scheduler = setupScheduler(app)
  const { server, wss } = initServer()
  signals(server, { wss, scheduler })

  return {
    app,
    server,
  }
}
