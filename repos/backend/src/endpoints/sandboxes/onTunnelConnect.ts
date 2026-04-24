import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'

import net from 'net'
import { URL } from 'url'
import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { Exception, hashKey, ESandboxSessionVisibility } from '@tdsk/domain'
import type { TRateLimiterBackend } from '@TBE/services/rateLimiter'
import { InMemoryRateLimiter } from '@TBE/services/rateLimiter'
import {
  SBTcpTimeout,
  TunnelRateWindow,
  TunnelRateLimit,
  TunnelBlockDuration,
  SBBackpressureMaxWait,
  SBBackpressureThreshold,
  TunnelFastCloseThreshold,
} from '@TBE/constants/sandbox'

/**
 * Tunnel rate limiter — pluggable backend for multi-replica deployments.
 * Defaults to in-memory; swap to Redis/DB implementation via `setTunnelRateLimiter`.
 */
let tunnelLimiter: TRateLimiterBackend = new InMemoryRateLimiter()

export const setTunnelRateLimiter = (backend: TRateLimiterBackend): void => {
  tunnelLimiter = backend
}

export const recordTunnelFailure = (sandboxId: string): void => {
  tunnelLimiter.record(sandboxId)
}

export const clearTunnelFailures = (sandboxId?: string): void => {
  tunnelLimiter.clear(sandboxId)
}

export const checkTunnelRateLimit = (sandboxId: string): boolean => {
  if (!tunnelLimiter.isLimited(sandboxId, TunnelRateWindow, TunnelRateLimit)) return false
  return tunnelLimiter.isBlocked(sandboxId, TunnelBlockDuration)
}

/**
 * Handle WebSocket tunnel connections for SSH access to sandbox pods.
 *
 * Auth: API key in Authorization header (validated here, not by Express middleware).
 * Path: /_/sandboxes/:id/tunnel
 * Protocol: Binary WebSocket frames bridged to TCP on pod:2222.
 */
export const onTunnelConnect = async (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): Promise<void> => {
  const { db, sandbox: sbService, kube } = app.locals

  // 1. Extract sandbox ID from URL
  const pathname = new URL(req.url || ``, `http://localhost`).pathname
  const match = pathname.match(/^\/_\/sandboxes\/([^/]+)\/tunnel$/)
  if (!match) {
    ws.close(4000, `Invalid tunnel path`)
    return
  }
  const sandboxId = match[1]

  // Rate guard: reject pathological connect/disconnect cycles
  if (checkTunnelRateLimit(sandboxId)) {
    logger.debug(`[Tunnel] Rate limited for sandbox ${sandboxId}`)
    ws.close(4008, `Too many failed connections, retry later`)
    return
  }
  const connectTime = Date.now()

  // Track fast closes for rate guard — registered early so pre-TCP failures
  // (auth, pod lookup) also count. The guard flag prevents double-counting
  // when the post-TCP cleanup function also closes the WebSocket.
  let rateGuardCounted = false
  ws.on(`close`, () => {
    if (!rateGuardCounted && Date.now() - connectTime < TunnelFastCloseThreshold) {
      rateGuardCounted = true
      recordTunnelFailure(sandboxId)
    }
  })

  // 2. Authenticate via API key
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith(`Bearer `)) {
    ws.close(4001, `Authorization required`)
    return
  }

  const token = authHeader.slice(7)
  const keyHash = hashKey(token)
  const { data: apiKey, error: keyErr } = await db.services.apiKey.getByHash(keyHash)
  if (keyErr || !apiKey || !apiKey.isValid()) {
    ws.close(4001, `Invalid or expired API key`)
    return
  }

  const orgId = apiKey.orgId
  const userId = apiKey.userId
  if (!orgId || !userId) {
    ws.close(4001, `API key missing org or user scope`)
    return
  }

  // 3. Find running pod for this sandbox
  if (!sbService || !kube) {
    ws.close(4003, `Sandbox service not available`)
    return
  }

  const podName = await sbService.findRunningPod(sandboxId, orgId)
  if (!podName) {
    ws.close(4004, `No running pod for sandbox ${sandboxId}`)
    return
  }

  // 4. Validate pod ownership
  try {
    await sbService.validatePodOwnership(podName, orgId)
  } catch (err) {
    if (err instanceof Exception) {
      logger.warn(`[Tunnel] Pod validation failed for ${podName}:`, err.message)
      ws.close(err.status === 404 ? 4004 : 4003, err.message)
    } else {
      logger.error(
        `[Tunnel] Unexpected error validating pod ${podName}:`,
        (err as Error).message
      )
      ws.close(4005, `Failed to validate pod access`)
    }
    return
  }

  // 5. Look up pod IP
  let podIp: string | undefined
  try {
    const pod = await kube.getPod(podName)
    podIp = pod.status?.podIP
  } catch (err) {
    logger.error(`[Tunnel] Failed to look up pod ${podName} IP:`, (err as Error).message)
    ws.close(4004, `Pod ${podName} is no longer reachable`)
    return
  }
  if (!podIp) {
    ws.close(4004, `Pod has no IP address`)
    return
  }

  // 6. Open TCP connection to pod SSH port with timeout
  const tcp = net.createConnection({ host: podIp, port: 2222, timeout: SBTcpTimeout })

  const sessionId = nanoid(12)
  let closed = false
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const cleanup = () => {
    if (closed) return
    closed = true
    if (pingInterval) clearInterval(pingInterval)
    try {
      sbService.removeSession(podName, sessionId)
    } catch (e) {
      logger.error('[Tunnel] removeSession failed:', (e as Error).message)
    }
    try {
      tcp.destroy()
    } catch (e) {
      logger.error('[Tunnel] tcp.destroy failed:', (e as Error).message)
    }
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      try {
        ws.close()
      } catch (e) {
        logger.error('[Tunnel] ws.close failed:', (e as Error).message)
      }
    }
  }

  // 7. Bridge WebSocket ↔ TCP (session registered on TCP connect, not before)
  tcp.on(`connect`, () => {
    logger.info(`[Tunnel] Connected to pod ${podName}:2222 (session ${sessionId})`)
    clearTunnelFailures(sandboxId)

    // Register session only after TCP connects successfully
    sbService.addSession(podName, {
      orgId,
      userId,
      podName,
      sessionId,
      sandboxId,
      connectedAt: new Date().toISOString(),
      visibility: ESandboxSessionVisibility.private,
    })

    // Start keepalive pings (every 30s) to prevent Caddy idle timeout
    let pongReceived = true
    ws.on(`pong`, () => {
      pongReceived = true
    })

    pingInterval = setInterval(() => {
      if (ws.readyState !== ws.OPEN) {
        cleanup()
        return
      }
      if (!pongReceived) {
        cleanup()
        return
      }
      pongReceived = false
      ws.ping()
    }, 30_000)
  })

  tcp.on(`timeout`, () => {
    logger.warn(`[Tunnel] TCP connection to ${podName}:2222 timed out`)
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close(4005, `SSH connection timed out - pod may not be ready`)
    }
    cleanup()
  })

  tcp.on(`data`, (chunk: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(chunk)
      // TCP-to-WS backpressure with bounded polling
      if (ws.bufferedAmount > SBBackpressureThreshold) {
        tcp.pause()
        const start = Date.now()
        const drain = () => {
          if (closed || ws.readyState !== ws.OPEN) {
            tcp.resume()
            return
          }
          if (ws.bufferedAmount <= SBBackpressureThreshold) {
            tcp.resume()
          } else if (Date.now() - start > SBBackpressureMaxWait) {
            logger.warn(`[Tunnel] Backpressure timeout for ${podName}, resuming TCP`)
            tcp.resume()
          } else {
            setTimeout(drain, 10)
          }
        }
        setTimeout(drain, 10)
      }
    }
  })

  ws.on(`message`, (data: Buffer) => {
    if (!tcp.destroyed) {
      const ok = tcp.write(data)
      if (!ok) {
        // WS-to-TCP backpressure
        ws.pause()
        tcp.once(`drain`, () => ws.resume())
      }
    }
    sbService.updateActivity(podName)
  })

  tcp.on(`error`, (err) => {
    logger.error(`[Tunnel] TCP error for ${podName}:`, err.message)
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close(4005, `SSH connection to pod failed`)
    }
    cleanup()
  })

  tcp.on(`close`, () => {
    logger.info(`[Tunnel] TCP closed for ${podName} (session ${sessionId})`)
    cleanup()
  })

  ws.on(`close`, () => {
    logger.info(`[Tunnel] WebSocket closed for ${podName} (session ${sessionId})`)
    cleanup()
  })

  ws.on(`error`, (err) => {
    logger.error(`[Tunnel] WebSocket error for ${podName}:`, err.message)
    cleanup()
  })
}
