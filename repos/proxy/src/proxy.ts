import type { TProxyConfig } from '@TPX/types'

import { signals } from '@TPX/utils/signals'
import { app, initServer, router } from '@TPX/server'
import { initJWKS } from '@TPX/utils/auth/neonAuth'
import { setupAuth } from '@TPX/middleware/setupAuth'
import { setupProxy } from '@TPX/middleware/setupProxy'
import { setupLogger } from '@TPX/middleware/setupLogger'
import { setupServer } from '@TPX/middleware/setupServer'
import { setupEndpoints } from '@TPX/middleware/setupEndpoints'
import { setupErrorHandler } from '@TPX/middleware/setupErrorHandler'

/**
 * Main proxy server initialization
 * Sets up all middleware, routes, and starts the server
 */
export const proxy = (config: TProxyConfig) => {
  app.locals.config = config

  // Initialize JWKS for JWT validation
  if (config.jwks?.jwksUrl) {
    initJWKS(config.jwks.jwksUrl)
  }

  setupLogger(app)
  setupServer(app, router)
  setupAuth(app)
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
