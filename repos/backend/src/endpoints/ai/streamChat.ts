import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { AssistantMessageEvent } from '@mariozechner/pi-ai'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getSession } from '@TBE/services/sessionStore'
import { getModel, streamSimple } from '@mariozechner/pi-ai'
import { logger } from '@TBE/utils/logger'

const SessionPrefix = `Session `

/**
 * Extract session token from Authorization: Session <token> header
 */
const extractSessionToken = (req: TRequest): string | undefined => {
  const header = req.headers.authorization
  if (!header || !header.startsWith(SessionPrefix)) return undefined
  return header.slice(SessionPrefix.length).trim()
}

/**
 * Convert a pi-ai AssistantMessageEvent to a ProxyAssistantMessageEvent
 * (strips the `partial` field to reduce SSE bandwidth)
 */
const toProxyEvent = (
  event: AssistantMessageEvent
): Record<string, unknown> | undefined => {
  switch (event.type) {
    case `start`:
      return { type: `start` }
    case `text_start`:
      return { type: `text_start`, contentIndex: event.contentIndex }
    case `text_delta`:
      return { type: `text_delta`, contentIndex: event.contentIndex, delta: event.delta }
    case `text_end`:
      return { type: `text_end`, contentIndex: event.contentIndex }
    case `thinking_start`:
      return { type: `thinking_start`, contentIndex: event.contentIndex }
    case `thinking_delta`:
      return {
        type: `thinking_delta`,
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    case `thinking_end`:
      return { type: `thinking_end`, contentIndex: event.contentIndex }
    case `toolcall_start`: {
      const tc = event.partial.content[event.contentIndex]
      return {
        type: `toolcall_start`,
        contentIndex: event.contentIndex,
        id: tc?.type === `toolCall` ? tc.id : ``,
        toolName: tc?.type === `toolCall` ? tc.name : ``,
      }
    }
    case `toolcall_delta`:
      return {
        type: `toolcall_delta`,
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    case `toolcall_end`:
      return { type: `toolcall_end`, contentIndex: event.contentIndex }
    case `done`:
      return { type: `done`, reason: event.reason, usage: event.message.usage }
    case `error`:
      return {
        type: `error`,
        reason: event.reason,
        errorMessage: event.error.errorMessage,
        usage: event.error.usage,
      }
    default:
      return undefined
  }
}

/**
 * POST /ai/stream - Proxy LLM calls using a session token
 *
 * The client sends { model, context, options }; the backend looks up the
 * cached session (which has the decrypted API key), calls streamSimple,
 * and streams ProxyAssistantMessageEvent back via SSE.
 *
 * Also supports the legacy /ai/chat path for backward compatibility.
 */
export const streamChat: TEndpointConfig = {
  path: `/stream`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const token = extractSessionToken(req)
    if (!token) throw new Exception(401, `Session token required`)

    const session = getSession(token)
    if (!session) throw new Exception(401, `Invalid or expired session`)

    const { model: clientModel, context, options = {} } = req.body
    if (!context?.messages || !Array.isArray(context.messages)) {
      throw new Exception(400, `context.messages is required and must be an array`)
    }

    // Use server-side model from session, but allow client to override provider/model
    const model = getModel(
      session.llmConfig.provider as any,
      session.llmConfig.model as any
    )

    if (!model)
      throw new Exception(
        400,
        `Unknown model "${session.llmConfig.model}" for provider "${session.llmConfig.provider}"`
      )

    // Build the context with server-side system prompt
    const streamContext = {
      systemPrompt: session.llmConfig.systemPrompt,
      messages: context.messages,
      tools: context.tools,
    }

    // SSE headers
    res.setHeader(`Content-Type`, `text/event-stream`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Connection`, `keep-alive`)
    res.flushHeaders()

    let aborted = false
    res.on(`close`, () => {
      aborted = true
      logger.info(`Stream proxy: client disconnected`)
    })

    try {
      logger.info(
        `Stream proxy: provider=${session.llmConfig.provider}, model=${session.llmConfig.model}, messages=${context.messages.length}`
      )

      for await (const event of streamSimple(model, streamContext, {
        apiKey: session.llmConfig.apiKey,
        headers: session.llmConfig.headers,
        maxTokens: options.maxTokens ?? session.llmConfig.maxTokens,
        temperature: options.temperature ?? session.llmConfig.temperature,
      })) {
        if (aborted) break
        const proxyEvent = toProxyEvent(event)
        if (proxyEvent) {
          res.write(`data: ${JSON.stringify(proxyEvent)}\n\n`)
        }
      }

      logger.info(`Stream proxy: completed`)
    } catch (err) {
      const message = err instanceof Error ? err.message : `LLM proxy error`
      logger.error(`Stream proxy error: ${message}`)
      if (!aborted) {
        res.write(
          `data: ${JSON.stringify({
            type: `error`,
            reason: `error`,
            errorMessage: message,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
          })}\n\n`
        )
      }
    }

    if (!aborted) {
      res.end()
    }
  },
}
