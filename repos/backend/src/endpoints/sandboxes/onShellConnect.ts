import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'
import type {
  TShellSession,
  TShellControlMsg,
  TWebSocketMeta,
} from '@TBE/types/shellSession.types'
import type { SandboxService } from '@TBE/services/sandboxes/sandbox'

import { Client } from 'ssh2'
import { nanoid } from 'nanoid'
import {
  hashKey,
  ESandboxSessionVisibility,
  PlanLimits,
  TerminalParser,
  GhosttyVT,
  deriveToolState,
} from '@tdsk/domain'
import type { ESubscriptionTier, TParsedEvent } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { RingBuffer } from '@TBE/utils/ringBuffer'
import { PodLabelKeys } from '@tdsk/sandbox'
import { SBBackpressureThreshold } from '@TBE/constants/sandbox'
import { verifyShellToken } from '@TBE/services/sessionToken'

const inputBuffers = new WeakMap<WebSocket, string>()
const wsMeta = new Map<WebSocket, TWebSocketMeta>()
const MaxInputBufferSize = 4096

const WS_PING_INTERVAL = 30_000
const SSH_KEEPALIVE_INTERVAL = 15_000
const SSH_READY_TIMEOUT = 10_000

let wasmReady = false

async function ensureWasmReady() {
  if (wasmReady) return
  await GhosttyVT.init()
  wasmReady = true
}

function broadcastEvent(session: TShellSession, sessionId: string, event: TParsedEvent) {
  const msg = JSON.stringify({ sessionId, event })
  for (const client of session.attachments) {
    if (client.readyState === 1) {
      client.send(msg)
    }
  }
}

/**
 * Handle WebSocket shell connections for interactive terminal access to sandbox pods.
 *
 * Auth: API key in Authorization header, or shell token in ?token query param (validated here, not by Express middleware).
 * Path: /_/sandboxes/:id/shell
 * Protocol:
 *   - Binary frames (browser → server): raw stdin bytes → SSH stream
 *   - Text frames (browser → server): JSON control messages (resize, signal, visibility) — see TShellControlMsg
 *   - Binary frames (server → browser): raw stdout bytes from SSH stream
 *   - Text frames (server → browser): JSON status messages (connected, reconnected, joined, visibility, user-joined, user-left, disconnected, error) — see TShellServerMsg
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

  try {
    await ensureWasmReady()
  } catch (err) {
    logger.error('[Shell] WASM initialization failed:', (err as Error).message)
    ws.close(4005, 'Terminal engine initialization failed')
    return
  }

  let closed = false
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const cleanup = (reason: string) => {
    if (closed) return
    closed = true
    if (pingInterval) clearInterval(pingInterval)

    const meta = wsMeta.get(ws)
    if (meta?.sessionId)
      sbService.detachFromShellSession(meta.sessionId, ws, meta.joinedUserId)
    wsMeta.delete(ws)

    try {
      if (ws.readyState === ws.OPEN)
        ws.send(JSON.stringify({ type: `disconnected`, reason }))
    } catch (err) {
      logger.debug(`[Shell] Failed to send disconnect message:`, (err as Error).message)
    }
    try {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) ws.close()
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

  // 5. Handle reconnect/join via sessionId param
  if (reconnectSessionId) {
    const existing = sbService.getShellSession(reconnectSessionId)
    if (existing && existing.sandboxId === sandboxId) {
      if (existing.userId === userId) {
        // Own session reconnection
        const session = sbService.attachToShellSession(reconnectSessionId, ws)
        if (!session) {
          ws.close(4005, `Session expired during reconnection`)
          return
        }
        wsMeta.set(ws, { sessionId: reconnectSessionId })

        let buffered = session.buffer.drain()

        if (buffered.length > 0) {
          ws.send(buffered)
        } else {
          // Ring buffer empty (no output during disconnect gap).
          // Use the parser's raw buffer — the full session PTY history.
          try {
            const rawData = session.parser.getRawBuffer()
            if (rawData.length > 0) {
              const buf = Buffer.from(rawData)
              ws.send(buf)
              buffered = buf
            }
          } catch (err) {
            logger.warn(
              `[Shell] Failed to get parser raw buffer:`,
              (err as Error).message
            )
          }

          // Fall back to ptyBuffer from DB (only populated after stream close)
          if (buffered.length === 0) {
            try {
              const { data: thread } = await db.services.thread.get(session.threadId)
              if (thread?.ptyBuffer) {
                const buf = Buffer.isBuffer(thread.ptyBuffer)
                  ? thread.ptyBuffer
                  : Buffer.from(thread.ptyBuffer)
                ws.send(buf)
                buffered = buf
              }
            } catch (err) {
              logger.warn(
                `[Shell] Failed to load PTY buffer for thread ${session.threadId}:`,
                (err as Error).message
              )
            }
          }
        }

        // Replay persisted events so ChatView has history after page reload
        try {
          await sbService.flushEventBatch(reconnectSessionId)
          const { data: messages } = await db.services.message.listByThread(
            session.threadId
          )
          if (messages && messages.length > 0) {
            for (const msg of messages) {
              const event = msg.content as unknown as TParsedEvent
              if (event?.type) {
                ws.send(JSON.stringify({ sessionId: reconnectSessionId, event }))
              }
            }
          }
        } catch (err) {
          logger.warn(
            `[Shell] Failed to replay events on reconnect:`,
            (err as Error).message
          )
        }

        const podName = await sbService.findRunningPod(sandboxId, orgId)
        let podOwnerUserId = userId
        if (podName) {
          try {
            const pod = await kube.getPod(podName)
            podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? userId
          } catch (err) {
            logger.warn(
              `[Shell] Failed to get pod labels for ${podName} during reconnect:`,
              (err as Error).message
            )
          }
        }

        const { data: sbConfig, error: sbConfigErr } =
          await db.services.sandbox.get(sandboxId)
        if (sbConfigErr) {
          logger.warn(
            '[Shell] Failed to load sandbox config for reconnect:',
            sbConfigErr.message
          )
        }

        ws.send(
          JSON.stringify({
            sandboxId,
            podOwnerUserId,
            type: `reconnected`,
            threadId: session.threadId,
            sessionId: reconnectSessionId,
            visibility: session.visibility,
            bufferedBytes: buffered.length,
            runtime: sbConfig?.config?.runtime ?? `custom`,
          })
        )

        wireWebSocket(ws, session, sbService, cleanup, podName)
        startPingInterval()
        return
      }

      // Cross-user join — verify public + project access
      if (existing.visibility !== ESandboxSessionVisibility.public) {
        ws.close(4003, `Session is not shared`)
        return
      }

      // Verify joining user has org membership
      const { data: userRole, error: roleErr } = await db.services.role.getOrgRole(
        userId,
        orgId
      )
      if (roleErr) {
        logger.warn(
          `[Shell] Role lookup failed for user ${userId} in org ${orgId}:`,
          roleErr.message
        )
      }
      if (!userRole) {
        ws.close(4003, `Not authorized to join this session`)
        return
      }

      const { data: sbConfig, error: sbConfigErr } =
        await db.services.sandbox.get(sandboxId)
      if (sbConfigErr) {
        logger.warn(
          '[Shell] Failed to load sandbox config for reconnect:',
          sbConfigErr.message
        )
      }

      const session = sbService.attachToShellSession(reconnectSessionId, ws)
      if (!session) {
        ws.close(4005, `Session expired`)
        return
      }
      wsMeta.set(ws, { sessionId: reconnectSessionId, joinedUserId: userId })

      const buffered = session.buffer.drain()
      if (buffered.length > 0) {
        ws.send(buffered)
      } else {
        // Ring buffer empty — use parser's raw buffer (full PTY history)
        let sent = false
        try {
          const rawData = session.parser.getRawBuffer()
          if (rawData.length > 0) {
            ws.send(Buffer.from(rawData))
            sent = true
          }
        } catch (err) {
          logger.warn(`[Shell] Failed to get parser raw buffer:`, (err as Error).message)
        }

        if (!sent) {
          try {
            const { data: thread } = await db.services.thread.get(session.threadId)
            if (thread?.ptyBuffer) {
              const buf = Buffer.isBuffer(thread.ptyBuffer)
                ? thread.ptyBuffer
                : Buffer.from(thread.ptyBuffer)
              ws.send(buf)
            }
          } catch (err) {
            logger.warn(
              `[Shell] Failed to load PTY buffer for thread ${session.threadId}:`,
              (err as Error).message
            )
          }
        }
      }

      // Replay persisted events so ChatView has history on join
      try {
        await sbService.flushEventBatch(reconnectSessionId)
        const { data: messages } = await db.services.message.listByThread(
          session.threadId
        )
        if (messages && messages.length > 0) {
          for (const msg of messages) {
            const event = msg.content as unknown as TParsedEvent
            if (event?.type) {
              ws.send(JSON.stringify({ sessionId: reconnectSessionId, event }))
            }
          }
        }
      } catch (err) {
        logger.warn(`[Shell] Failed to replay events on join:`, (err as Error).message)
      }

      const podName = await sbService.findRunningPod(sandboxId, orgId)
      let podOwnerUserId = existing.userId
      if (podName) {
        try {
          const pod = await kube.getPod(podName)
          podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? existing.userId
        } catch (err) {
          logger.warn(
            `[Shell] Failed to get pod labels for ${podName} during join:`,
            (err as Error).message
          )
        }
      }

      ws.send(
        JSON.stringify({
          sandboxId,
          type: `joined`,
          podOwnerUserId,
          threadId: session.threadId,
          sessionId: reconnectSessionId,
          runtime: sbConfig?.config?.runtime ?? `custom`,
        })
      )

      // Notify other attachments
      for (const client of session.attachments) {
        if (client !== ws && client.readyState === 1) {
          client.send(
            JSON.stringify({ type: `user-joined`, sessionId: reconnectSessionId, userId })
          )
        }
      }

      wireWebSocket(ws, session, sbService, cleanup, podName)
      startPingInterval()
      return
    }
  }

  // 6. Find running pod
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

  // 7. Get pod info and verify requesting user is the pod creator
  let podOwnerUserId: string
  let podIp: string | undefined
  try {
    const pod = await kube.getPod(podName)
    podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? ``
    podIp = pod.status?.podIP
  } catch (err) {
    logger.warn(`[Shell] Failed to get pod ${podName}:`, (err as Error).message)
    ws.close(4004, `Pod not reachable`)
    return
  }

  if (podOwnerUserId !== userId) {
    ws.close(4003, `Cannot create sessions on a pod you did not start`)
    return
  }

  // 8. Check PlanLimits concurrent session cap
  try {
    const { data: org } = await db.services.org.get(orgId)
    if (org?.ownerId) {
      const { data: sub } = await db.services.subscription.findByUser(org.ownerId)
      const tier = (sub?.tier ?? `free`) as ESubscriptionTier
      const limit = PlanLimits[tier].sandboxSessions
      if (limit !== -1) {
        const count = sbService.getOrgShellSessionCount(orgId)
        if (count >= limit) {
          ws.close(4029, `Session limit reached for your plan`)
          return
        }
      }
    }
  } catch (err) {
    logger.error(
      `[Shell] PlanLimits check failed, denying session:`,
      (err as Error).message
    )
    ws.close(4029, `Unable to verify session limits. Please try again.`)
    return
  }

  // 9. Validate pod IP and get SSH password
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

  // 10. Get sandbox config for runtime info
  const { data: sandbox, error: sbErr } = await db.services.sandbox.get(sandboxId)
  if (sbErr) {
    logger.warn(`[Shell] Failed to load sandbox config for ${sandboxId}:`, sbErr.message)
  }
  const runtime = sandbox?.config?.runtime ?? `custom`
  const runtimeCommand = sandbox?.config?.runtimeCommand

  // 11. Create thread for session history
  const { data: thread, error: threadErr } = await db.services.thread.create({
    orgId,
    userId,
    sandboxId,
    meta: { runtime, shellSessionId: `` },
    projectId: sandbox?.projects?.[0]?.id ?? undefined,
    name: `${sandbox?.name ?? `Sandbox`} \u2014 ${new Date().toISOString()}`,
  })

  if (threadErr || !thread) {
    ws.close(4005, `Failed to create session thread`)
    return
  }
  const threadId = thread.id

  // 12. Establish SSH connection
  const sessionId = nanoid(16)
  const sshClient = new Client()

  sshClient.on(`ready`, () => {
    sshClient.shell({ term: `xterm-256color`, cols, rows }, (err, stream) => {
      if (err || !stream) {
        ws.close(4005, `Shell allocation failed`)
        sshClient.end()
        return
      }

      // Create a ref that the closure can capture
      let sessionRef: TShellSession | null = null

      const parser = new TerminalParser({
        runtime,
        onEvent: (event) => {
          const session = sessionRef
          if (!session) return

          // Tool-call completion tracking
          if (session.lastRunningToolCall) {
            const completionTriggers = [
              `tool-call`,
              `prompt-ready`,
              `permission`,
              `error`,
            ]
            if (completionTriggers.includes(event.type)) {
              const done: TParsedEvent = {
                ...session.lastRunningToolCall,
                status: `done`,
                timestamp: Date.now(),
              }
              sbService.queueEventForPersistence(sessionId, done)
              broadcastEvent(session, sessionId, done)
              session.lastRunningToolCall = null
            }
          }

          if (event.type === `tool-call` && event.status === `running`) {
            session.lastRunningToolCall = event as TParsedEvent & { type: `tool-call` }
          }

          // Update tool state
          const newState = deriveToolState(event, {
            lastRunningTool: session.lastRunningToolCall?.tool,
          })
          if (newState && newState !== session.toolState) {
            session.toolState = newState
          }

          sbService.queueEventForPersistence(sessionId, event)
          broadcastEvent(session, sessionId, event)
        },
        cols,
        rows,
      })

      const session: TShellSession = {
        orgId,
        userId,
        parser,
        threadId,
        sandboxId,
        sessionId,
        sshClient,
        ttlTimer: null,
        sshStream: stream,
        attachments: new Set([ws]),
        buffer: new RingBuffer(1024 * 1024),
        toolState: `idle`,
        lastRunningToolCall: null,
        projectId: sandbox?.projects?.[0]?.id ?? undefined,
        visibility: ESandboxSessionVisibility.private,
      }

      sessionRef = session

      sbService.addShellSession(session)
      wsMeta.set(ws, { sessionId })

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
        visibility: ESandboxSessionVisibility.private,
        projectId: sandbox?.projects?.[0]?.id ?? undefined,
      })

      ws.send(
        JSON.stringify({
          type: `connected`,
          runtime,
          threadId,
          sessionId,
          sandboxId,
          podOwnerUserId,
        })
      )

      // Execute runtime command if requested
      if (shouldRun && runtimeCommand) stream.write(`${runtimeCommand}\n`)

      // SSH stream -> WebSocket fan-out
      stream.on(`data`, (data: Buffer) => {
        try {
          parser.write(data)
        } catch (err) {
          logger.error('[Shell] Parser write failed:', (err as Error).message)
        }

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
        if (session.lastRunningToolCall) {
          const done: TParsedEvent = {
            ...session.lastRunningToolCall,
            status: `done`,
            timestamp: Date.now(),
          }
          sbService.queueEventForPersistence(sessionId, done)
          broadcastEvent(session, sessionId, done)
          session.lastRunningToolCall = null
        }

        try {
          parser.flush()
          const rawBuffer = parser.getRawBuffer()
          if (rawBuffer.length > 0) {
            db.services.thread
              .update({ id: threadId, ptyBuffer: Buffer.from(rawBuffer) })
              .catch((err) => {
                logger.error(
                  `[Shell] Failed to persist PTY buffer for thread ${threadId}:`,
                  (err as Error).message
                )
              })
          }
        } catch (err) {
          logger.error(
            '[Shell] Parser flush/buffer extraction failed:',
            (err as Error).message
          )
        }

        parser.destroy()
        sbService.flushEventBatch(sessionId).catch((err) => {
          logger.error('[Shell] Final event batch flush failed:', (err as Error).message)
        })
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
    password,
    port: 2222,
    host: podIp,
    username: `sandbox`,
    readyTimeout: SSH_READY_TIMEOUT,
    keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
  })
}

function wireWebSocket(
  ws: WebSocket,
  session: TShellSession,
  sbService: SandboxService,
  cleanup: (reason: string) => void,
  podName?: string
) {
  inputBuffers.set(ws, ``)

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
          session.parser.resize(msg.cols, msg.rows)
        } else if (msg.type === `signal`) {
          if (msg.signal === `SIGINT`) session.sshStream.write(`\x03`)
          else if (msg.signal === `SIGTSTP`) session.sshStream.write(`\x1a`)
        } else if (msg.type === `permission-response`) {
          session.sshStream.write(`${msg.response}\n`)
        } else if (msg.type === `visibility`) {
          // Only the session creator can toggle visibility.
          // For the owner's WS, joinedUserId is unset so it falls back to session.userId (matching).
          // For joiners, joinedUserId is set to their userId (non-matching).
          const authUserId = wsMeta.get(ws)?.joinedUserId ?? session.userId
          if (authUserId !== session.userId) return

          if (!Object.values(ESandboxSessionVisibility).includes(msg.visibility)) return

          const newVis = msg.visibility
          sbService.updateSessionVisibility(session.sessionId, newVis)

          for (const client of session.attachments) {
            if (client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: `visibility`,
                  visibility: newVis,
                  sessionId: session.sessionId,
                })
              )
            }
          }
        }
      } catch (err) {
        logger.warn(`[Shell] Failed to process control message:`, (err as Error).message)
      }
      return
    }

    // Buffer input and emit input events on submitted commands (newline)
    const raw = data.toString()

    // Control characters (Ctrl+C, Ctrl+Z) reset the input buffer —
    // the user abandoned the current line
    if (/[\x03\x1a]/.test(raw)) {
      inputBuffers.set(ws, ``)
    } else {
      const text = raw.replace(/\r\n/g, `\n`).replace(/\r/g, `\n`)
      let buffered = (inputBuffers.get(ws) ?? ``) + text

      if (buffered.length > MaxInputBufferSize) {
        buffered = buffered.slice(-MaxInputBufferSize)
      }

      if (buffered.includes(`\n`)) {
        const lines = buffered.split(`\n`)
        inputBuffers.set(ws, lines.pop()!)
        const userId = wsMeta.get(ws)?.joinedUserId ?? session.userId
        for (const line of lines) {
          const content = line.trim()
          if (content.length > 0) {
            const event: TParsedEvent = {
              type: `input`,
              content,
              userId,
              timestamp: Date.now(),
            }
            sbService.queueEventForPersistence(session.sessionId, event)
            broadcastEvent(session, session.sessionId, event)
          }
        }
      } else {
        inputBuffers.set(ws, buffered)
      }
    }

    session.sshStream.write(data)
    if (podName) sbService.updateActivity(podName)
  })

  ws.on(`close`, () => {
    inputBuffers.delete(ws)
    wsMeta.delete(ws)
    cleanup(`WebSocket closed`)
  })
  ws.on(`error`, (err) => cleanup(`WebSocket error: ${err.message}`))
}
