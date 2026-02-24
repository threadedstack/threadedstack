import type { IncomingMessage } from 'http'
import type { Socket } from 'net'
import type { TApp } from '@TBE/types'

import { WebSocketServer } from 'ws'
import { logger } from '@TBE/utils/logger'
import { onWSConnect } from '@TBE/endpoints/ai/onWSConnect'

const WS_PATH = `/ai/ws`

/**
 * Creates a WebSocket server for agent execution.
 * Uses `noServer: true` — the HTTP server's `upgrade` event is handled manually
 * so we can filter by path and reject non-matching upgrade requests.
 */
export const createWSServer = (app: TApp) => {
  const wss = new WebSocketServer({ noServer: true })

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = new URL(req.url || ``, `http://localhost`).pathname
    if (pathname !== WS_PATH) {
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      onWSConnect(ws, req, app).catch((err) => {
        logger.error(`WS connect error`, {
          error: err instanceof Error ? err.message : err,
        })
        ws.close(1011, `Internal error`)
      })
    })
  }

  logger.info(`WebSocket server ready on path: ${WS_PATH}`)

  return { wss, onUpgrade }
}
