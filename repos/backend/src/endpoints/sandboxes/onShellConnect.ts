import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'
import type { TShellSession, TShellControlMsg } from '@TBE/types/shellSession.types'
import type { SandboxService } from '@TBE/services/sandboxes/sandbox'

import { Client } from 'ssh2'
import { nanoid } from 'nanoid'
import { hashKey } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { TerminalParser } from '@tdsk/domain'
import { RingBuffer } from '@TBE/utils/ringBuffer'
import { SBBackpressureThreshold } from '@TBE/constants/sandbox'
import { verifyShellToken } from '@TBE/services/sessionToken'

const WS_PING_INTERVAL = 30_000
const SSH_KEEPALIVE_INTERVAL = 15_000
const SSH_READY_TIMEOUT = 10_000

/**
 * Handle WebSocket shell connections for interactive terminal access to sandbox pods.
 *
 * Auth: API key in Authorization header (validated here, not by Express middleware).
 * Path: /_/sandboxes/:id/shell
 * Protocol:
 *   - Binary frames (browser → server): raw stdin bytes → SSH stream
 *   - Text frames (browser → server): JSON control messages (resize, signal)
 *   - Binary frames (server → browser): raw stdout bytes from SSH stream
 *   - Text frames (server → browser): JSON status messages (connected, reconnected, error)
 *
 * Unlike the tunnel endpoint (raw TCP bridge), this handler:
 *   - Establishes an SSH connection via ssh2.Client and allocates a PTY shell
 *   - Parses terminal output via TerminalParser for event persistence
 *   - Manages persistent sessions via the session broker (survives WS reconnects)
 *   - Creates a thread per session for history storage
 */
export const onShellConnect = async (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): Promise<void> => {
  const { db, sandbox: sbService, kube } = app.locals

  let closed = false
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const cleanup = (reason: string) => {
    if (closed) return
    closed = true
    if (pingInterval) clearInterval(pingInterval)

    const sessionId = (ws as any).__shellSessionId as string | undefined
    if (sessionId) {
      sbService.detachFromShellSession(sessionId, ws)
    }

    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: `disconnected`, reason }))
      }
    } catch (err) {
      logger.debug(`[Shell] Failed to send disconnect message:`, (err as Error).message)
    }
    try {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close()
      }
    } catch (err) {
      logger.debug(`[Shell] Failed to close WebSocket:`, (err as Error).message)
    }
  }

  const startPingInterval = () => {
    pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping()
      else cleanup(`WebSocket no longer open`)
    }, WS_PING_INTERVAL)
  }

  // 1. Extract sandbox ID from URL
  const pathname = new URL(req.url || ``, `http://localhost`).pathname
  const match = pathname.match(/^\/_\/sandboxes\/([^/]+)\/shell$/)
  if (!match) {
    ws.close(4000, `Invalid shell path`)
    return
  }
  const sandboxId = match[1]

  // 2. Parse query params
  const url = new URL(req.url || ``, `http://localhost`)
  const cols = Number.parseInt(url.searchParams.get(`cols`) ?? `80`, 10)
  const rows = Number.parseInt(url.searchParams.get(`rows`) ?? `24`, 10)
  const shouldRun = url.searchParams.get(`run`) === `true`
  const reconnectSessionId = url.searchParams.get(`sessionId`)

  // 3. Authenticate via API key or shell token
  const queryToken = url.searchParams.get(`token`)
  const authHeader = req.headers.authorization

  let orgId: string
  let userId: string

  if (authHeader?.startsWith(`Bearer `)) {
    // API key auth (TSA CLI flow)
    const token = authHeader.slice(7)
    const keyHash = hashKey(token)
    const { data: apiKey, error: keyErr } = await db.services.apiKey.getByHash(keyHash)
    if (keyErr || !apiKey || !apiKey.isValid()) {
      ws.close(4001, `Invalid or expired API key`)
      return
    }
    if (!apiKey.orgId || !apiKey.userId) {
      ws.close(4001, `API key missing org or user scope`)
      return
    }
    orgId = apiKey.orgId
    userId = apiKey.userId
  } else if (queryToken) {
    // Shell session token auth (browser flow)
    const payload = verifyShellToken(queryToken)
    if (!payload) {
      ws.close(4001, `Invalid or expired shell token`)
      return
    }
    if (payload.sandboxId !== sandboxId) {
      ws.close(4001, `Token sandbox mismatch`)
      return
    }
    orgId = payload.orgId
    userId = payload.userId
  } else {
    ws.close(4001, `Authorization required`)
    return
  }

  // 4. Check sandbox service availability
  if (!sbService || !kube) {
    ws.close(4003, `Sandbox service not available`)
    return
  }

  // 5. Handle reconnection to existing session
  if (reconnectSessionId) {
    const existing = sbService.getShellSession(reconnectSessionId)
    if (existing && existing.userId === userId && existing.sandboxId === sandboxId) {
      const session = sbService.attachToShellSession(reconnectSessionId, ws)
      if (!session) {
        ws.close(4005, `Session expired during reconnection`)
        return
      }
      ;(ws as any).__shellSessionId = reconnectSessionId

      const buffered = session.buffer.drain()
      if (buffered.length > 0) ws.send(buffered)

      ws.send(
        JSON.stringify({
          type: `reconnected`,
          sessionId: reconnectSessionId,
          bufferedBytes: buffered.length,
        })
      )

      wireWebSocket(ws, session, sbService, cleanup)
      startPingInterval()
      return
    }
  }

  // 6. Check for existing session for this sandbox+user
  const existingSession = sbService.findShellSessionForSandbox(sandboxId, userId)
  if (existingSession) {
    sbService.attachToShellSession(existingSession.sessionId, ws)
    ;(ws as any).__shellSessionId = existingSession.sessionId

    const buffered = existingSession.buffer.drain()
    if (buffered.length > 0) ws.send(buffered)

    ws.send(
      JSON.stringify({
        type: `reconnected`,
        sessionId: existingSession.sessionId,
        bufferedBytes: buffered.length,
      })
    )

    wireWebSocket(ws, existingSession, sbService, cleanup)
    startPingInterval()
    return
  }

  // 7. Find running pod
  const podName = await sbService.findRunningPod(sandboxId, orgId)
  if (!podName) {
    ws.close(4004, `No running pod for sandbox ${sandboxId}`)
    return
  }

  try {
    await sbService.validatePodOwnership(podName, orgId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : `Not authorized`
    logger.warn(`[Shell] Pod ownership validation failed for ${podName}:`, msg)
    ws.close(4003, `Not authorized`)
    return
  }

  // 8. Get pod IP and SSH password
  let podIp: string | undefined
  try {
    const pod = await kube.getPod(podName)
    podIp = pod.status?.podIP
  } catch (err) {
    logger.warn(`[Shell] Failed to get pod ${podName}:`, (err as Error).message)
    ws.close(4004, `Pod not reachable`)
    return
  }
  if (!podIp) {
    ws.close(4004, `Pod has no IP address`)
    return
  }

  let password = sbService.getPassword(podName)
  if (!password) {
    password = await sbService.recoverPassword(podName)
  }
  if (!password) {
    ws.close(4005, `Cannot recover SSH credentials`)
    return
  }

  // 9. Get sandbox config for runtime info
  const { data: sandbox, error: sbErr } = await db.services.sandbox.get(sandboxId)
  if (sbErr) {
    logger.warn(`[Shell] Failed to load sandbox config for ${sandboxId}:`, sbErr.message)
  }
  const runtime = sandbox?.config?.runtime ?? `custom`
  const runtimeCommand = sandbox?.config?.runtimeCommand

  // 10. Create thread for session history
  const { data: thread, error: threadErr } = await db.services.thread.create({
    name: `${sandbox?.name ?? `Sandbox`} \u2014 ${new Date().toISOString()}`,
    sandboxId,
    orgId,
    userId,
    projectId: sandbox?.projects?.[0]?.id ?? undefined,
    meta: { runtime, shellSessionId: `` },
  })
  if (threadErr || !thread) {
    ws.close(4005, `Failed to create session thread`)
    return
  }
  const threadId = thread.id

  // 11. Establish SSH connection
  const sessionId = nanoid(16)
  const sshClient = new Client()

  sshClient.on(`ready`, () => {
    sshClient.shell({ term: `xterm-256color`, cols, rows }, (err, stream) => {
      if (err || !stream) {
        ws.close(4005, `Shell allocation failed`)
        sshClient.end()
        return
      }

      const parser = new TerminalParser({
        runtime,
        onEvent: (event) => {
          sbService.queueEventForPersistence(sessionId, event)
        },
        onToolState: () => {},
      })

      const session: TShellSession = {
        sessionId,
        sshClient,
        sshStream: stream,
        buffer: new RingBuffer(1024 * 1024),
        attachments: new Set([ws]),
        parser,
        threadId,
        userId,
        orgId,
        sandboxId,
        ttlTimer: null,
      }

      sbService.addShellSession(session)
      ;(ws as any).__shellSessionId = sessionId

      // Update thread meta with session ID
      db.services.thread
        .update({
          id: threadId,
          meta: { runtime, shellSessionId: sessionId },
        })
        .catch((err) => {
          logger.error(
            `[Shell] Failed to update thread ${threadId} with session ${sessionId}:`,
            (err as Error).message
          )
        })

      // Register as a pod session too (for idle timeout tracking)
      sbService.addSession(podName, {
        orgId,
        userId,
        podName,
        sessionId,
        sandboxId,
        connectedAt: new Date().toISOString(),
      })

      ws.send(
        JSON.stringify({
          type: `connected`,
          sessionId,
          sandboxId,
          runtime,
          threadId,
        })
      )

      // Execute runtime command if requested
      if (shouldRun && runtimeCommand) {
        stream.write(`${runtimeCommand}\n`)
      }

      // SSH stream -> WebSocket fan-out
      stream.on(`data`, (data: Buffer) => {
        parser.write(data.toString())

        if (session.attachments.size === 0) {
          session.buffer.write(data)
          return
        }

        for (const client of session.attachments) {
          if (client.readyState === 1) {
            client.send(data)
            if ((client as any).bufferedAmount > SBBackpressureThreshold) {
              stream.pause()
              const resume = () => {
                if ((client as any).bufferedAmount <= SBBackpressureThreshold) {
                  stream.resume()
                } else {
                  setTimeout(resume, 16)
                }
              }
              setTimeout(resume, 16)
            }
          }
        }
      })

      stream.on(`close`, () => {
        parser.flush()
        sbService.flushEventBatch(sessionId)
        sbService.removeSession(podName, sessionId)
        cleanup(`SSH stream closed`)
        sbService.removeShellSession(sessionId)
      })

      stream.on(`error`, (streamErr: Error) => {
        cleanup(`SSH error: ${streamErr.message}`)
      })

      wireWebSocket(ws, session, sbService, cleanup, podName)
      startPingInterval()
    })
  })

  sshClient.on(`error`, (sshErr) => {
    logger.error(`[Shell] SSH connection failed for pod ${podName}:`, sshErr.message)
    ws.close(4005, `SSH connection failed: ${sshErr.message}`)
  })

  sshClient.connect({
    host: podIp,
    port: 2222,
    username: `sandbox`,
    password,
    keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
    readyTimeout: SSH_READY_TIMEOUT,
  })
}

function wireWebSocket(
  ws: WebSocket,
  session: TShellSession,
  sbService: SandboxService,
  cleanup: (reason: string) => void,
  podName?: string
) {
  ws.on(`message`, (data, isBinary) => {
    if (typeof data === `string` || !isBinary) {
      let msg: TShellControlMsg
      try {
        msg = JSON.parse(data.toString()) as TShellControlMsg
      } catch {
        return // Non-JSON text, skip
      }
      try {
        if (msg.type === `resize`) {
          session.sshStream.setWindow(msg.rows, msg.cols, msg.rows * 16, msg.cols * 8)
        } else if (msg.type === `signal`) {
          if (msg.signal === `SIGINT`) session.sshStream.write(`\x03`)
          else if (msg.signal === `SIGTSTP`) session.sshStream.write(`\x1a`)
        }
      } catch (err) {
        logger.warn(`[Shell] Failed to process control message:`, (err as Error).message)
      }
      return
    }

    const inputStr = data.toString()
    session.parser.trackInput(inputStr)
    session.sshStream.write(data)
    if (podName) sbService.updateActivity(podName)
  })

  ws.on(`close`, () => cleanup(`WebSocket closed`))
  ws.on(`error`, (err) => cleanup(`WebSocket error: ${err.message}`))
}
