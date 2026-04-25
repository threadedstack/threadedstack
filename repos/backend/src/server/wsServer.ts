import type WebSocket from 'ws'
import type { Socket } from 'net'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'

import { WebSocketServer } from 'ws'
import { logger } from '@TBE/utils/logger'
import { onWSConnect } from '@TBE/endpoints/ai/onWSConnect'
import { WsMaxConnectionsPerIp } from '@TBE/constants/values'
import { SBTunnelPattern, SBShellPattern } from '@TBE/constants/sandbox'
import { onShellConnect } from '@TBE/endpoints/sandboxes/onShellConnect'
import { onTunnelConnect } from '@TBE/endpoints/sandboxes/onTunnelConnect'

type TWsHandler = (ws: WebSocket, req: IncomingMessage, app: TApp) => Promise<void>

export const createWSServer = (app: TApp) => {
  const wss = new WebSocketServer({ noServer: true })
  const connectionsPerIp = new Map<string, number>()

  const getClientIp = (req: IncomingMessage): string =>
    (req.headers[`x-forwarded-for`] as string)?.split(`,`)[0]?.trim() ||
    req.socket.remoteAddress ||
    `unknown`

  const trackConnection = (ws: WebSocket, ip: string) => {
    const current = connectionsPerIp.get(ip) || 0
    connectionsPerIp.set(ip, current + 1)
    ws.on(`close`, () => {
      const count = connectionsPerIp.get(ip) || 1
      if (count <= 1) connectionsPerIp.delete(ip)
      else connectionsPerIp.set(ip, count - 1)
    })
  }

  const staticRoutes = new Map<string, TWsHandler>()
  staticRoutes.set(`/ai/ws`, onWSConnect)

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = new URL(req.url || ``, `http://localhost`).pathname
    const clientIp = getClientIp(req)

    // Enforce per-IP connection limit
    const currentCount = connectionsPerIp.get(clientIp) || 0
    if (currentCount >= WsMaxConnectionsPerIp) {
      logger.warn(
        `[WS] Connection limit exceeded for IP ${clientIp} (${currentCount}/${WsMaxConnectionsPerIp})`
      )
      socket.destroy()
      return
    }

    // Static route match
    const staticHandler = staticRoutes.get(pathname)
    if (staticHandler) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        trackConnection(ws, clientIp)
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
        trackConnection(ws, clientIp)
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
        trackConnection(ws, clientIp)
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
