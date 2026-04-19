import type { Server as HTTP } from 'http'
import type { Server as HTTPS } from 'https'
import type { WebSocketServer } from 'ws'
import type { Scheduler } from '@TBE/services/scheduler'

import { logger } from '@TBE/utils/logger'
import { sigs } from '@TBE/constants/values'

const SHUTDOWN_TIMEOUT_MS = 5_000

type TSignalOpts = {
  wss?: WebSocketServer
  scheduler?: Scheduler
}

export const signals = (server: HTTP | HTTPS, opts?: TSignalOpts) => {
  let shuttingDown = false

  sigs.forEach((sig) => {
    process.on(sig, () => {
      if (shuttingDown) return
      shuttingDown = true

      logger.info(`Received ${sig}, starting graceful shutdown`)

      // 1. Stop the scheduler
      if (opts?.scheduler) {
        try {
          opts.scheduler.stop()
        } catch (e) {
          logger.error(`Failed to stop scheduler:`, (e as Error).message)
        }
      }

      // 2. Close all WebSocket connections
      if (opts?.wss) {
        opts.wss.clients.forEach((ws) => {
          try {
            ws.close(1001, `Server shutting down`)
          } catch (e) {
            /* client may already be closed */
          }
        })
      }

      // 3. Stop accepting new connections
      server.close(() => {
        logger.info(`Server closed, exiting`)
        process.exit(0)
      })

      // 4. Force exit after timeout
      setTimeout(() => {
        logger.warn(
          `Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`
        )
        process.exit(1)
      }, SHUTDOWN_TIMEOUT_MS).unref()
    })
  })
}
