import type { Server as HTTP } from 'http'
import type { Server as HTTPS } from 'https'

import { logger } from './logger'
import { sigs } from '../constants/values'

export const signals = (server: HTTP|HTTPS) => {
  sigs.forEach((sig) => {
    process.on(sig, () => {
      logger.debug(`Received ${sig} signal`)
      try {
        server.close(() => {
          logger.info(`Server exited`)
          process.exit(0)
        })
      } catch (e) {
        logger.error(`an error occurred while shutting down server`, { err: e })
        process.exit(1)
      }
    })
  })
}
