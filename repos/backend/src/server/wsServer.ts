import type WebSocket from 'ws'
import type { Socket } from 'net'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'

import { WebSocketServer } from 'ws'
import { logger } from '@TBE/utils/logger'
import { onWSConnect } from '@TBE/endpoints/ai/onWSConnect'
import { SBTunnelPattern, SBShellPattern } from '@TBE/constants/sandbox'
import { onShellConnect } from '@TBE/endpoints/sandboxes/onShellConnect'
import { onTunnelConnect } from '@TBE/endpoints/sandboxes/onTunnelConnect'

type TWsHandler = (ws: WebSocket, req: IncomingMessage, app: TApp) => Promise<void>

/**
 * Creates a WebSocket server with path-based dispatch.
 * Uses `noServer: true` — the HTTP server's `upgrade` event is handled manually
 * so we can filter by path and route to the correct handler.
 */
export const createWSServer = (app: TApp) => {
  const wss = new WebSocketServer({ noServer: true })

  const staticRoutes = new Map<string, TWsHandler>()
  staticRoutes.set(`/ai/ws`, onWSConnect)

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = new URL(req.url || ``, `http://localhost`).pathname

    // Static route match
    const staticHandler = staticRoutes.get(pathname)
    if (staticHandler) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        staticHandler(ws, req, app).catch((err) => {
          logger.error(`WS connect error on ${pathname}`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    // Dynamic route: sandbox tunnel
    const tunnelMatch = pathname.match(SBTunnelPattern)
    if (tunnelMatch) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        onTunnelConnect(ws, req, app).catch((err) => {
          logger.error(`WS tunnel error`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    // Dynamic route: sandbox shell
    const shellMatch = pathname.match(SBShellPattern)
    if (shellMatch) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        onShellConnect(ws, req, app).catch((err) => {
          logger.error(`WS shell error`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    socket.destroy()
  }

  logger.info(`WebSocket server ready (multi-path dispatch)`)

  return { wss, onUpgrade }
}
