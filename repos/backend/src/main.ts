import type { TBEConfig } from '@TBE/types'

import { app } from '@TBE/server/app'
import { router } from '@TBE/server/router'
import { signals } from '@TBE/utils/signals'
import { initServer } from '@TBE/server/server'
import { S3Service } from '@TBE/services/s3/s3'
import { EmailService } from '@TBE/services/email'
import { EmbeddingService } from '@TBE/services/embeddings/embedding'
import { setupServer } from '@TBE/middleware/setupServer'
import { setupRateLimit } from '@TBE/middleware/rateLimit'
import { setupLogger } from '@TBE/middleware/setupLogger'
import { setupSandbox } from '@TBE/middleware/setupSandbox'
import { setupDatabase } from '@TBE/middleware/setupDatabase'
import { setupEndpoints } from '@TBE/middleware/setupEndpoints'
import { setupScheduler } from '@TBE/middleware/setupScheduler'
import { setupResidentWatchdog } from '@TBE/middleware/setupResidentWatchdog'
import { setupSandboxProxy } from '@TBE/middleware/sandboxProxy'
import { PaymentsService } from '@TBE/services/payments/payments'
import { setupErrorHandler } from '@TBE/middleware/setupErrorHandler'

export const main = async (config: TBEConfig) => {
  app.locals.config = config
  app.locals.s3 = new S3Service(config.s3)
  app.locals.email = new EmailService(config.email)
  app.locals.payments = new PaymentsService(config.payments)

  setupLogger(app)
  setupServer(app, router)
  setupRateLimit(app)
  setupDatabase(app)

  // Depends on app.locals.db (set by setupDatabase) at embed() time
  app.locals.embeddings = new EmbeddingService(app)

  await setupSandbox(app)
  setupSandboxProxy(app)

  setupEndpoints(app, router)
  setupErrorHandler(app)

  const scheduler = setupScheduler(app)
  const residentWatchdog = setupResidentWatchdog(app)
  const { server, wss } = initServer()
  signals(server, { wss, scheduler, residentWatchdog })

  return {
    app,
    server,
  }
}
