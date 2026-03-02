import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'
import type { TWSClientMsg } from '@tdsk/domain'

import { URL } from 'url'
import { logger } from '@TBE/utils/logger'
import { EWSEventType } from '@tdsk/domain'
import { verifySessionToken } from '@TBE/services/sessionToken'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { resolveProviderType } from '@TBE/utils/providers/resolveProviderType'
import { Websocket } from '@TBE/services/websocket/websocket'

const ClientMsgTypes = new Set<string>([
  EWSEventType.Prompt,
  EWSEventType.Cancel,
  EWSEventType.Steer,
  EWSEventType.FollowUp,
  EWSEventType.FileUpload,
  EWSEventType.UpdateConfig,
  EWSEventType.WorkspaceManifest,
])

/**
 * Parse and validate an incoming WebSocket message.
 * Returns null for invalid/unrecognised payloads.
 */
const parseClientMsg = (raw: Buffer | string): TWSClientMsg | null => {
  try {
    const msg = JSON.parse(typeof raw === `string` ? raw : raw.toString(`utf8`))
    if (!msg || typeof msg.type !== `string` || !ClientMsgTypes.has(msg.type)) return null
    return msg as TWSClientMsg
  } catch {
    return null
  }
}

/**
 * Resolve the full session data from a verified token payload.
 * Loads the agent (unsanitized) and resolves secrets from the DB.
 */
const resolveSession = async (
  payload: { userId: string; agentId: string; orgId: string },
  app: TApp
) => {
  try {
    const { db } = app.locals

    const { data: agent, error: agentErr } = await db.services.agent.get(
      payload.agentId,
      {
        sanitize: false,
      }
    )

    if (agentErr || !agent) return null

    const provider = agent.primaryProvider
    if (!provider) return null

    const secrets = new SecretResolver(db)
    const apiKey = await secrets.resolveApiKey(agent, provider)
    if (!apiKey) return null

    const providerType = resolveProviderType(provider)
    const headers = await secrets.resolveHeaders(provider)
    const bodyParams = await secrets.resolveBodyParams(provider)

    return {
      userId: payload.userId,
      agentId: agent.id,
      orgId: agent.orgId,
      tools: agent.tools as string[] | undefined,
      envVars: agent.envVars as Record<string, string> | undefined,
      environment: agent.environment,
      customFunctions: undefined as any[] | undefined,
      llmConfig: {
        apiKey,
        headers,
        bodyParams,
        provider: providerType as any,
        systemPrompt: agent.systemPrompt,
        maxTokens: agent.maxTokens || 4096,
        temperature: agent.environment?.temperature,
        model: agent.model || provider.options?.model,
        baseUrl: provider.options?.baseUrl as string | undefined,
      },
    }
  } catch (err) {
    logger.error(`Failed to resolve session`, {
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}

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
  const sessionPromise = resolveSession(payload, app)

  let running = false
  const { db } = app.locals

  // 3. Handle WebSocket errors (fires before close on abnormal disconnects)
  ws.on(`error`, (err: Error) => {
    logger.error(`WebSocket error`, { error: err.message })
  })

  // 4. Handle incoming messages — waits for session before processing
  ws.on(`message`, async (raw: Buffer | string) => {
    const session = await sessionPromise
    if (!session) {
      service.send({
        type: EWSEventType.Error,
        message: `Agent session could not be resolved`,
      })
      return
    }

    try {
      const msg = parseClientMsg(raw)
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
          // Phase 8 — workspace file sync (placeholder)
          logger.debug(`WS file_upload received: ${msg.path}`)
          break

        case EWSEventType.WorkspaceManifest:
          // Phase 8 — workspace manifest (placeholder)
          logger.debug(`WS workspace_manifest received: ${msg.files?.length} files`)
          break
      }
    } catch (err) {
      logger.error(`Unhandled WS message error`, {
        error: err instanceof Error ? err.message : err,
      })
      ws.close(1011, `Internal error`)
    }
  })

  // 5. Cleanup on disconnect (destroy persistent runner + close WS)
  ws.on(`close`, () => {
    sessionPromise.then((session) => {
      if (session) {
        logger.info(`WS disconnected: agent=${session.agentId}, user=${session.userId}`)
      }
    })
    if (service.abortController) {
      service.abortController.abort()
      service.abortController = null
    }
    service.close().catch((err) => {
      logger.error(`WS close error`, { error: err instanceof Error ? err.message : err })
    })
  })

  // 6. Await session resolution — close if it fails
  const session = await sessionPromise
  if (!session) {
    ws.close(4001, `Failed to resolve agent session`)
    return
  }

  logger.info(`WS connected: agent=${session.agentId}, user=${session.userId}`)
}
