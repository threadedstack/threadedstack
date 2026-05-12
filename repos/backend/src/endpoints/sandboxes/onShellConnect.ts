import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'
import type { TExecStream } from '@tdsk/sandbox'
import type { ESubscriptionTier, ERoleType } from '@tdsk/domain'
import type { SandboxService } from '@TBE/services/sandboxes/sandbox'
import type {
  TPtyRecorder,
  TShellSession,
  TWebSocketMeta,
} from '@TBE/types/shellSession.types'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { PodLabelKeys } from '@tdsk/sandbox'
import { RingBuffer } from '@TBE/utils/ringBuffer'
import { verifyShellToken } from '@TBE/services/sessionToken'
import { parseShellControlMsg } from '@TBE/utils/shell/parseControlMsg'
import {
  WsPingInterval,
  MaxPtyBufferSize,
  SBBackpressureMaxWait,
  SBBackpressureThreshold,
} from '@TBE/constants/sandbox'
import {
  hashKey,
  canPerform,
  PlanLimits,
  EPermAction,
  ApiKeyPrefix,
  EPermResource,
  DefaultWorkdir,
  ESandboxSessionVisibility,
} from '@tdsk/domain'

const wsMeta = new Map<WebSocket, TWebSocketMeta>()

function createPtyRecorder(): TPtyRecorder {
  const chunks: Uint8Array[] = []
  let totalSize = 0

  return {
    write(data: Uint8Array) {
      totalSize += data.length
      chunks.push(data)
      while (totalSize > MaxPtyBufferSize && chunks.length > 1) {
        totalSize -= chunks.shift()!.length
      }
    },
    getRawBuffer(): Uint8Array {
      const result = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      return result
    },
    destroy() {
      chunks.length = 0
      totalSize = 0
    },
  }
}

/**
 * Handle WebSocket shell connections for interactive terminal access to sandbox pods.
 *
 * Auth: API key in Authorization header, or shell token in ?token query param (validated here, not by Express middleware).
 * Path: /_/sandboxes/:id/shell
 * Protocol:
 *   - Binary frames (browser -> server): raw stdin bytes -> exec stream
 *   - Text frames (browser -> server): JSON control messages (resize, signal, visibility) -- see TShellControlMsg
 *   - Binary frames (server -> browser): raw stdout bytes from exec stream
 *   - Text frames (server -> browser): JSON status messages (connected, reconnected, joined, visibility, user-joined, user-left, disconnected, error) -- see TShellServerMsg
 *
 * Unlike the tunnel endpoint (raw TCP bridge), this handler:
 *   - Establishes a kubectl exec connection and allocates a PTY shell
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
    let pongReceived = true
    ws.on(`pong`, () => {
      pongReceived = true
    })

    pingInterval = setInterval(() => {
      if (ws.readyState !== ws.OPEN) {
        cleanup(`WebSocket no longer open`)
        return
      }
      if (!pongReceived) {
        cleanup(`Pong timeout`)
        return
      }
      pongReceived = false
      ws.ping()
    }, WsPingInterval)
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
    const token = authHeader.slice(7)

    if (token.startsWith(ApiKeyPrefix)) {
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
    } else {
      const payload = verifyShellToken(token)
      if (!payload) {
        ws.close(4001, `Invalid or expired token`)
        return
      }
      if (payload.sandboxId !== sandboxId) {
        ws.close(4001, `Token not authorized for this sandbox`)
        return
      }
      orgId = payload.orgId
      userId = payload.userId
    }
  } else if (queryToken) {
    // Shell session token auth (browser flow)
    const payload = verifyShellToken(queryToken)
    if (!payload) {
      ws.close(4001, `Invalid or expired shell token`)
      return
    }
    if (payload.sandboxId !== sandboxId) {
      ws.close(4001, `Invalid or expired shell token`)
      return
    }
    orgId = payload.orgId
    userId = payload.userId
  } else {
    ws.close(4001, `Authorization required`)
    return
  }

  // 3b. Verify sandbox belongs to the authenticated org
  const { data: sbRecord, error: sbGetErr } = await db.services.sandbox.get(sandboxId)
  if (sbGetErr) {
    logger.error(`[Shell] Sandbox lookup failed for ${sandboxId}:`, sbGetErr.message)
    ws.close(4005, `Failed to verify sandbox, please retry`)
    return
  }
  if (!sbRecord) {
    ws.close(4004, `Sandbox not found`)
    return
  }
  if (sbRecord.orgId !== orgId) {
    ws.close(4001, `Sandbox not authorized`)
    return
  }

  // 3c. Check exec permission on sandbox resource
  const { error: roleErr, data: userOrgRole } = await db.services.role.getOrgRole(
    userId,
    orgId
  )
  if (roleErr) {
    logger.error(
      `[Shell] Role lookup failed for user ${userId} in org ${orgId}:`,
      roleErr.message
    )
    ws.close(4005, `Permission check failed, please retry`)
    return
  }
  const effectiveRole = (userOrgRole?.type as ERoleType | null) ?? null
  const permResult = canPerform(effectiveRole, EPermAction.exec, EPermResource.sandbox)
  if (!permResult.allowed) {
    ws.close(4003, permResult.reason || `Permission denied`)
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
          // Use the ptyRecorder's raw buffer -- the full session PTY history.
          try {
            const rawData = session.ptyRecorder.getRawBuffer()
            if (rawData.length > 0) {
              const buf = Buffer.from(rawData)
              ws.send(buf)
              buffered = buf
            }
          } catch (err) {
            logger.warn(`[Shell] Failed to get PTY raw buffer:`, (err as Error).message)
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

        const requestedInstance = url.searchParams.get(`instanceId`)
        let instanceId: string | undefined
        if (requestedInstance) {
          instanceId = await sbService.findRunningInstance(
            requestedInstance,
            orgId,
            sandboxId
          )
        } else {
          const runningInstances = await sbService.findRunningInstances(sandboxId, orgId)
          instanceId = runningInstances[0]
        }
        if (requestedInstance && !instanceId) {
          ws.close(4004, `Requested instance is not running`)
          return
        }
        let podOwnerUserId = userId
        if (instanceId) {
          try {
            const pod = await kube.getPod(instanceId)
            podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? userId
          } catch (err) {
            logger.warn(
              `[Shell] Failed to get pod labels for ${instanceId} during reconnect:`,
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

        wireWebSocket(ws, session, sbService, cleanup, instanceId)
        startPingInterval()
        return
      }

      // Cross-user join -- verify public + project access
      if (existing.visibility !== ESandboxSessionVisibility.public) {
        ws.close(4003, `Session is not shared`)
        return
      }

      // Verify joining user has exec permission on sandbox
      const { data: joinUserRole, error: joinRoleErr } =
        await db.services.role.getOrgRole(userId, orgId)
      if (joinRoleErr) {
        logger.error(
          `[Shell] Join role lookup failed for user ${userId} in org ${orgId}:`,
          joinRoleErr.message
        )
        ws.close(4005, `Permission check failed, please retry`)
        return
      }
      const joinRole = (joinUserRole?.type as ERoleType | null) ?? null
      const joinPermResult = canPerform(joinRole, EPermAction.exec, EPermResource.sandbox)
      if (!joinPermResult.allowed) {
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
        // Ring buffer empty -- use ptyRecorder's raw buffer (full PTY history)
        let sent = false
        try {
          const rawData = session.ptyRecorder.getRawBuffer()
          if (rawData.length > 0) {
            ws.send(Buffer.from(rawData))
            sent = true
          }
        } catch (err) {
          logger.warn(`[Shell] Failed to get PTY raw buffer:`, (err as Error).message)
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

      const requestedInstance = url.searchParams.get(`instanceId`)
      let instanceId: string | undefined
      if (requestedInstance) {
        instanceId = await sbService.findRunningInstance(
          requestedInstance,
          orgId,
          sandboxId
        )
      } else {
        const runningInstances = await sbService.findRunningInstances(sandboxId, orgId)
        instanceId = runningInstances[0]
      }
      if (requestedInstance && !instanceId) {
        ws.close(4004, `Requested instance is not running`)
        return
      }
      let podOwnerUserId = existing.userId
      if (instanceId) {
        try {
          const pod = await kube.getPod(instanceId)
          podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? existing.userId
        } catch (err) {
          logger.warn(
            `[Shell] Failed to get pod labels for ${instanceId} during join:`,
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

      wireWebSocket(ws, session, sbService, cleanup, instanceId)
      startPingInterval()
      return
    }
  }

  // 6. Find running instance
  const requestedInstance = url.searchParams.get(`instanceId`)
  let instanceId: string | undefined
  if (requestedInstance) {
    instanceId = await sbService.findRunningInstance(requestedInstance, orgId, sandboxId)
    if (!instanceId) {
      ws.close(4004, `Requested instance ${requestedInstance} is not running`)
      return
    }
  } else {
    const runningInstances = await sbService.findRunningInstances(sandboxId, orgId)
    instanceId = runningInstances[0]
  }
  if (!instanceId) {
    ws.close(4004, `No running instance for sandbox ${sandboxId}`)
    return
  }

  try {
    await sbService.validateInstanceOwnership(instanceId, orgId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : `Not authorized`
    logger.warn(`[Shell] Instance ownership validation failed for ${instanceId}:`, msg)
    ws.close(4003, `Not authorized`)
    return
  }

  // 7. Get pod info and verify requesting user is the pod creator
  let podOwnerUserId: string
  try {
    const pod = await kube.getPod(instanceId)
    podOwnerUserId = pod.metadata?.labels?.[PodLabelKeys.userId] ?? ``
  } catch (err) {
    logger.warn(`[Shell] Failed to get pod ${instanceId}:`, (err as Error).message)
    ws.close(4004, `Pod not reachable`)
    return
  }

  // 8. Check PlanLimits concurrent session cap
  try {
    const { data: org, error: orgErr } = await db.services.org.get(orgId)
    if (orgErr) {
      logger.error(`[Shell] Org lookup failed for ${orgId}:`, orgErr.message)
      ws.close(4029, `Unable to verify session limits. Please try again.`)
      return
    }
    if (!org) {
      ws.close(4004, `Organization not found`)
      return
    }
    if (org.ownerId) {
      const { data: sub, error: subErr } = await db.services.subscription.findByUser(
        org.ownerId
      )
      if (subErr) {
        logger.error(
          `[Shell] Subscription lookup failed for owner ${org.ownerId}:`,
          subErr.message
        )
        ws.close(4029, `Unable to verify session limits. Please try again.`)
        return
      }
      const tier = (sub?.tier ?? `free`) as ESubscriptionTier
      const planLimit = PlanLimits[tier]
      if (!planLimit) {
        logger.error(`[Shell] Unknown subscription tier "${sub?.tier}" for org ${orgId}`)
        ws.close(4029, `Unable to verify session limits. Please try again.`)
        return
      }
      if (planLimit.sandboxSessions !== -1) {
        const count = sbService.getOrgShellSessionCount(orgId)
        if (count >= planLimit.sandboxSessions) {
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

  // 9. Get sandbox config for runtime info
  const { data: sandbox, error: sbErr } = await db.services.sandbox.get(sandboxId)
  if (sbErr) {
    logger.warn(`[Shell] Failed to load sandbox config for ${sandboxId}:`, sbErr.message)
  }
  const runtime = sandbox?.config?.runtime ?? `custom`
  const runtimeCommand = sandbox?.config?.runtimeCommand
  const workdir = sandbox?.config?.workdir || DefaultWorkdir

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

  // 12. Establish kubectl exec connection
  const sessionId = nanoid(16)

  let exec: TExecStream
  try {
    exec = await kube.execStream(instanceId, [`su`, `-l`, `sandbox`], {
      tty: true,
      cols,
      rows,
    })
  } catch (err) {
    logger.error(
      `[Shell] Exec failed for instance ${instanceId}:`,
      (err as Error).message
    )
    ws.close(4005, `Shell connection failed`)
    return
  }

  const ptyRecorder = createPtyRecorder()

  const session: TShellSession = {
    orgId,
    userId,
    threadId,
    sandboxId,
    sessionId,
    ptyRecorder,
    ttlTimer: null,
    stdout: exec.stdout,
    stdin: exec.stdin,
    closeExec: exec.close,
    resize: exec.resize,
    attachments: new Set([ws]),
    buffer: new RingBuffer(1024 * 1024),
    visibility: ESandboxSessionVisibility.private,
    projectId: sandbox?.projects?.[0]?.id ?? undefined,
  }

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
  sbService.addSession(instanceId, {
    orgId,
    userId,
    instanceId,
    sessionId,
    sandboxId,
    connectedAt: new Date().toISOString(),
    visibility: ESandboxSessionVisibility.private,
    projectId: sandbox?.projects?.[0]?.id ?? undefined,
  })
  sbService.broadcastSessionList(sandboxId)

  ws.send(
    JSON.stringify({
      runtime,
      threadId,
      sessionId,
      sandboxId,
      podOwnerUserId,
      type: `connected`,
    })
  )

  // Always cd into workdir (exec sessions start in container default dir)
  exec.stdin.write(`cd '${workdir.replace(/'/g, `'\\''`)}'\n`)
  // Execute runtime command if requested
  if (shouldRun && runtimeCommand) exec.stdin.write(`${runtimeCommand}\n`)

  // Exec stdout -> WebSocket fan-out (raw binary bytes only)
  exec.stdout.on(`data`, (data: Buffer) => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    ptyRecorder.write(bytes)

    if (session.attachments.size === 0) {
      session.buffer.write(data)
      return
    }

    for (const client of session.attachments) {
      if (client.readyState === 1) {
        client.send(data)
        if ((client as any).bufferedAmount > SBBackpressureThreshold) {
          exec.stdout.pause()
          const start = Date.now()
          const resume = () => {
            if ((client as any).bufferedAmount <= SBBackpressureThreshold) {
              exec.stdout.resume()
            } else if (Date.now() - start > SBBackpressureMaxWait) {
              logger.warn(
                `[Shell] Backpressure timeout for ${instanceId}, resuming exec stdout`
              )
              exec.stdout.resume()
            } else {
              setTimeout(resume, 16)
            }
          }
          setTimeout(resume, 16)
        }
      }
    }
  })

  exec.stdout.on(`end`, () => {
    try {
      const rawBuffer = ptyRecorder.getRawBuffer()
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
      logger.error('[Shell] PTY buffer extraction failed:', (err as Error).message)
    }

    ptyRecorder.destroy()
    sbService.removeSession(instanceId, sessionId)
    cleanup(`Exec stream ended`)
    sbService.removeShellSession(sessionId)
  })

  exec.stdout.on(`error`, (streamErr: Error) => {
    try {
      const rawBuffer = ptyRecorder.getRawBuffer()
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
      logger.error('[Shell] PTY buffer extraction failed:', (err as Error).message)
    }

    ptyRecorder.destroy()
    sbService.removeSession(instanceId, sessionId)
    cleanup(`Exec error: ${streamErr.message}`)
    sbService.removeShellSession(sessionId)
  })

  exec.stderr.on(`data`, (chunk: Buffer) => {
    logger.debug(`[Shell] Exec stderr for ${instanceId}:`, chunk.toString().slice(0, 500))
  })

  exec.stderr.on(`error`, (err: Error) => {
    logger.warn(`[Shell] Exec stderr error for ${instanceId}:`, err.message)
  })

  exec.stdin.on(`error`, (err: Error) => {
    logger.warn(`[Shell] Exec stdin error for ${instanceId}:`, err.message)
    cleanup(`Exec stdin error: ${err.message}`)
  })

  wireWebSocket(ws, session, sbService, cleanup, instanceId)
  startPingInterval()
}

function wireWebSocket(
  ws: WebSocket,
  session: TShellSession,
  sbService: SandboxService,
  cleanup: (reason: string) => void,
  instanceId?: string
) {
  ws.on(`message`, (data, isBinary) => {
    if (typeof data === `string` || !isBinary) {
      const msg = parseShellControlMsg(data.toString())
      if (!msg) {
        logger.debug(`[Shell] Invalid control message: ${data.toString().slice(0, 100)}`)
        return
      }

      try {
        if (msg.type === `resize`) {
          session.resize(msg.cols, msg.rows)
        } else if (msg.type === `signal`) {
          if (session.stdin.writable) {
            if (msg.signal === `SIGINT`) session.stdin.write(`\x03`)
            else if (msg.signal === `SIGTSTP`) session.stdin.write(`\x1a`)
          }
        } else if (msg.type === `permission-response`) {
          if (session.stdin.writable) session.stdin.write(`${msg.response}\n`)
        } else if (msg.type === `visibility`) {
          // Only the session creator can toggle visibility.
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
          sbService.broadcastSessionList(session.sandboxId)
        }
      } catch (err) {
        logger.warn(`[Shell] Failed to process control message:`, (err as Error).message)
      }
      return
    }

    // Binary frame: forward raw stdin bytes to exec stream
    if (session.stdin.writable) session.stdin.write(data)
    if (instanceId) sbService.updateActivity(instanceId)
  })

  ws.on(`close`, () => {
    wsMeta.delete(ws)
    cleanup(`WebSocket closed`)
  })
  ws.on(`error`, (err) => cleanup(`WebSocket error: ${err.message}`))
}
