import type { TProxyApp } from '@TPX/types'
import type { TSSLCreds } from '@tdsk/domain'

import fs from 'fs'
import http from 'http'
import https from 'https'
import { logger } from '@TPX/utils/logger'

/**
 * Loads the ssl certs file content from the defined paths
 */
const loadCredFiles = (certs: TSSLCreds) => {
  return Object.entries(certs).reduce(
    (conf, [key, loc]: [string, string]) => {
      if (loc && fs.existsSync(loc)) {
        conf[key] = fs.readFileSync(loc, 'utf8')
      }
      return conf
    },
    {} as Record<string, string>
  )
}

/**
 * Creates a secure server if a valid certs object is defined in the config, then returns it
 */
const setupHttpsServer = (app: TProxyApp) => {
  const { certs, port, enableSSL } = app.locals.config.server

  if (!enableSSL || !certs?.cert || !certs?.key) return

  const credentials = loadCredFiles(certs)
  const httpsServer = https.createServer(credentials, app)

  const server = httpsServer
    .listen(port, () => {
      logger.info(`🔒 Proxy Secure Server running on port ${port}`)
    })
    .on(`error`, (e) => {
      logger.error({
        error: e.stack,
        message: `FATAL Error: ${e.name} ${e.message} - Shutting down server...`,
      })
      server.close()
    })

  return server
}

/**
 * Creates an insecure server and returns it
 */
const setupHttpServer = (app: TProxyApp) => {
  const { port } = app.locals.config.server
  const httpServer = http.createServer(app)

  const server = httpServer
    .listen(port, () => {
      logger.info(`🚀 Auth-Proxy Server running on port ${port}`)
    })
    .on(`error`, (e) => {
      logger.error({
        error: e.stack,
        message: `FATAL Error: ${e.name} ${e.message} - Shutting down server...`,
      })
      server.close()
    })

  return server
}

/**
 * Creates an express server based on the current app config
 */
export const initServer = (app: TProxyApp) => {
  const secureServer = setupHttpsServer(app)
  const server = secureServer || setupHttpServer(app)
  if (app.locals.onUpgrade) server.on(`upgrade`, app.locals.onUpgrade)

  return server
}
