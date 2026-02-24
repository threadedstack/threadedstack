import http from 'http'
import { app } from '@TBE/server/app'
import { logger } from '@TBE/utils/logger'
import { createWSServer } from '@TBE/server/wsServer'

/**
 * Create an express server based on the current app config
 */
export const initServer = () => {
  const { port } = app.locals.config.server
  const httpServer = http.createServer(app)

  // Attach WebSocket upgrade handler
  const { onUpgrade } = createWSServer(app)
  httpServer.on(`upgrade`, onUpgrade)

  const server = httpServer
    .listen(port, () => {
      logger.info(`🚀 Accounts Server running on port ${port}`)
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
