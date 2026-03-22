import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'

import { URL } from 'url'
import { logger } from '@TBE/utils/logger'
import { EWSEventType } from '@tdsk/domain'
import { Websocket } from '@TBE/services/websocket/websocket'
import { verifySessionToken } from '@TBE/services/sessionToken'

/**
 * Handle an incoming WebSocket connection for agent execution.
 *
 * Auth: session token is a signed JWT passed as `?token=<jwt>` query param.
 * The token was obtained via `POST /_/ai/sessions` (JWT/API key auth).
 * On connect, the agent config + secrets are resolved fresh from the DB.
 */
export const onWSConnect = async (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): Promise<void> => {
  // 1. Extract and verify session token from query string
  const url = new URL(req.url || ``, `http://localhost`)
  const token = url.searchParams.get(`token`)
  const service = new Websocket({ app, ws })

  if (!token) {
    ws.close(4001, `Session token required in ?token= query param`)
    return
  }

  const payload = verifySessionToken(token)
  if (!payload) {
    ws.close(4001, `Invalid or expired session`)
    return
  }

  // 2. Start resolving session (async) but register event handlers FIRST
  //    to avoid losing messages that arrive during DB resolution.
  const sessionPromise = service.resolveSession(payload)

  let running = false
  const { db } = app.locals

  // 3. Send periodic heartbeat messages so proxy/LB layers don't kill idle connections
  service.keepalive()

  // 4. Handle WebSocket errors (fires before close on abnormal disconnects)
  ws.on(`error`, (err: Error) => {
    logger.error(`WebSocket error`, {
      stack: err.stack,
      error: err.message,
      userId: payload.userId,
      agentId: payload.agentId,
    })
  })

  // 5. Handle incoming messages — waits for session before processing
  ws.on(`message`, async (raw: Buffer | string) => {
    const { session, error: sessionError } = await sessionPromise
    if (!session) {
      service.send({
        type: EWSEventType.Error,
        message: sessionError || `Agent session could not be resolved`,
      })
      return
    }

    try {
      const msg = service.parseMsg(raw)
      if (!msg) {
        service.send({
          type: EWSEventType.Error,
          message: `Invalid or unrecognised message`,
        })
        return
      }

      switch (msg.type) {
        case EWSEventType.Prompt:
          if (running) {
            service.send({
              type: EWSEventType.Error,
              message: `Agent is already running. Send cancel first.`,
            })
            service.send({ type: EWSEventType.Done, reason: `error` })
            break
          }
          running = true
          try {
            await service.handlePrompt(msg, session, db)
          } finally {
            running = false
          }
          break

        case EWSEventType.Cancel:
          if (service.abortController) {
            service.abortController.abort()
            service.abortController = null
            service.send({ type: EWSEventType.Done, reason: `cancelled` })
          }
          break

        case EWSEventType.Steer:
          service.handleSteer(msg.message)
          break

        case EWSEventType.FollowUp:
          service.handleFollowUp(msg.message)
          break

        case EWSEventType.UpdateConfig:
          service.handleUpdateConfig({
            model: msg.model,
            provider: msg.provider,
            tools: msg.tools,
            systemPrompt: msg.systemPrompt,
            thinkingLevel: msg.thinkingLevel as any,
          })
          break

        case EWSEventType.FileUpload:
          logger.debug(`WS file_upload received: ${msg.path}`)
          service.send({
            type: EWSEventType.Error,
            message: `File upload is not supported in this version`,
          })
          break

        case EWSEventType.WorkspaceManifest:
          logger.debug(`WS workspace_manifest received: ${msg.files?.length} files`)
          service.send({
            type: EWSEventType.Error,
            message: `Workspace sync is not supported in this version`,
          })
          break
      }
    } catch (err) {
      logger.error(`Unhandled WS message error`, {
        error: err instanceof Error ? err.message : err,
      })
      ws.close(1011, `Internal error`)
    }
  })

  // 6. Cleanup on disconnect (destroy persistent runner + close WS)
  ws.on(`close`, () => {
    sessionPromise
      .then(({ session }) => {
        if (session) {
          logger.info(`WS disconnected: agent=${session.agentId}, user=${session.userId}`)
        }
      })
      .catch((err) => {
        logger.error(`[WS] Session cleanup error`, {
          error: err instanceof Error ? err.message : err,
        })
      })

    service.close().catch((err) =>
      logger.error(`WS close error`, {
        error: err instanceof Error ? err.message : err,
      })
    )
  })

  // 7. Await session resolution — close if it fails
  const { session, error: sessionError } = await sessionPromise
  if (!session) {
    ws.close(4001, sessionError || `Failed to resolve agent session`)
    return
  }

  logger.info(`WS connected: agent=${session.agentId}, user=${session.userId}`)
}
