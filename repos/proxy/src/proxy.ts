import type { TProxyConfig } from '@TPX/types'

import { signals } from '@TPX/utils/signals'
import { app, initServer, router } from '@TPX/server'
import { setupAuth } from '@TPX/middleware/setupAuth'
import { setupProxy } from '@TPX/middleware/setupProxy'
import { setupLogger } from '@TPX/middleware/setupLogger'
import { setupServer } from '@TPX/middleware/setupServer'
import { setupRateLimit } from '@TPX/middleware/rateLimit'
import { setupPrewarm } from '@TPX/middleware/setupPrewarm'
import { setupDatabase } from '@TPX/middleware/setupDatabase'
import { setupEndpoints } from '@TPX/middleware/setupEndpoints'
import { setupApiKeyAuth } from '@TPX/middleware/setupApiKeyAuth'
import { setupSessionAuth } from '@TPX/middleware/setupSessionAuth'
import { setupErrorHandler } from '@TPX/middleware/setupErrorHandler'

/**
 * Main proxy server initialization
 * Sets up all middleware, routes, and starts the server
 */
export const proxy = (config: TProxyConfig) => {
  app.locals.config = config

  setupLogger(app)
  setupServer(app, router)
  setupRateLimit(app)
  setupDatabase(app)
  setupAuth(app)
  setupApiKeyAuth(app)
  setupSessionAuth(app)
  setupPrewarm(app)
  setupEndpoints(app, router)
  setupProxy(app)
  setupErrorHandler(app)

  const server = initServer(app)

  signals(server)

  return {
    app,
    server,
  }
}
