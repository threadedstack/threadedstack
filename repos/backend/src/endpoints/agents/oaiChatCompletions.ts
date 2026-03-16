import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { nanoid } from 'nanoid'
import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'
import {
  extractPrompt,
  buildOverrides,
  convertOAIMessages,
} from '@TBE/services/openai/requestAdapter'
import {
  createStreamingAdapter,
  createNonStreamingAdapter,
  formatOAIError,
} from '@TBE/services/openai/responseAdapter'

/**
 * POST /_/agents/:id/v1/chat/completions
 *
 * OpenAI-compatible chat completions endpoint.
 * Accepts the same request shape as the OpenAI API and returns
 * responses in the same format — streaming or non-streaming.
 *
 * The agent is identified by the URL `:id` param.
 * The `model` field in the request body is an optional LLM model override.
 * All messages except the last user message are seeded into a new thread
 * as conversation history. The last user message becomes the agent prompt.
 */
export const oaiChatCompletions: TEndpointConfig = {
  path: `/:id/v1/chat/completions`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const agentId = req.params.id
    const userId = req.user?.id
    const body = req.body

    if (!userId) throw new Exception(401, `Authentication required`)

    if (!body.messages?.length) {
      const { status, body: errBody } = formatOAIError(
        new Exception(400, `messages is required and must be non-empty`)
      )
      res.status(status).json(errBody)
      return
    }

    const prompt = extractPrompt(body.messages)
    if (!prompt) {
      const { status, body: errBody } = formatOAIError(
        new Exception(400, `No user message found in messages array`)
      )
      res.status(status).json(errBody)
      return
    }

    const overrides = buildOverrides(body)
    const completionId = `chatcmpl-${nanoid(24)}`
    const modelName = body.model || `default`

    const agent = new AgentEndpoint()

    // Resolve agent config once — replaces separate agent.get call and
    // avoids double-resolution when runHeadless is called later.
    let config
    try {
      config = await resolveAgentConfig(agentId, db, req.app as any, {
        userId,
        overrides,
      })
    } catch (err) {
      const { status, body: errBody } = formatOAIError(err)
      res.status(status).json(errBody)
      return
    }

    try {
      await checkPermission(req, EPermAction.read, EPermResource.agent, {
        orgId: config.orgId,
      })
    } catch (err) {
      const { status, body: errBody } = formatOAIError(err)
      res.status(status).json(errBody)
      return
    }

    // Seed thread with prior messages if conversation has history.
    let threadId: string | undefined
    const priorMessages = body.messages.slice(0, -1)
    if (priorMessages.length) {
      const converted = convertOAIMessages(priorMessages)
      if (converted.length) {
        try {
          const { data: thread, error: threadErr } = await db.services.thread.create({
            userId,
            agentId,
            orgId: config.orgId,
            name: prompt.substring(0, 100),
          })

          if (threadErr || !thread) {
            const { status, body: errBody } = formatOAIError(
              new Exception(500, `Failed to create thread for conversation seeding`)
            )
            res.status(status).json(errBody)
            return
          }

          threadId = thread.id

          for (const msg of converted) {
            const { error: msgErr } = await db.services.message.create({
              threadId,
              type: msg.type,
              content: msg.content,
            })
            if (msgErr) {
              logger.error(`[OAI Chat] Failed to seed message`, {
                agentId,
                threadId,
                messageType: msg.type,
                error: msgErr instanceof Error ? msgErr.message : msgErr,
              })
              const { status, body: errBody } = formatOAIError(
                new Exception(500, `Failed to seed conversation message`)
              )
              res.status(status).json(errBody)
              return
            }
          }
        } catch (err) {
          logger.error(`[OAI Chat] Message seeding failed`, {
            agentId,
            error: err instanceof Error ? err.message : err,
          })
          const { status, body: errBody } = formatOAIError(
            err instanceof Exception
              ? err
              : new Exception(500, `Failed to seed conversation history`)
          )
          res.status(status).json(errBody)
          return
        }
      }
    }

    if (body.stream) {
      // Streaming mode — SSE with OpenAI chunk format
      res.setHeader(`Content-Type`, `text/event-stream`)
      res.setHeader(`Cache-Control`, `no-cache`)
      res.setHeader(`Connection`, `keep-alive`)
      res.flushHeaders()

      const adapter = createStreamingAdapter(res, completionId, modelName)
      adapter.sendInitial()

      let aborted = false
      req.on(`close`, () => {
        aborted = true
      })

      try {
        await agent.runHeadless(req, db, {
          agentId,
          prompt,
          userId,
          threadId,
          overrides,
          resolvedConfig: config,
          onEvent: (event) => {
            if (aborted) return
            adapter.onEvent(event)
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : `Agent execution failed`
        logger.error(`[OAI Chat] Streaming error`, {
          error: err instanceof Error ? err : message,
          stack: err instanceof Error ? err.stack : undefined,
          agentId,
          threadId,
        })
        if (!aborted) {
          res.write(
            `data: ${JSON.stringify({
              error: { message, type: `server_error`, param: null, code: null },
            })}\n\n`
          )
        }
      }

      if (!aborted) {
        adapter.finish()
      }
    } else {
      // Non-streaming mode — collect events, return JSON
      const adapter = createNonStreamingAdapter(completionId, modelName)

      try {
        await agent.runHeadless(req, db, {
          agentId,
          prompt,
          userId,
          threadId,
          overrides,
          resolvedConfig: config,
          onEvent: adapter.onEvent,
        })
      } catch (err) {
        const { status, body: errBody } = formatOAIError(err)
        res.status(status).json(errBody)
        return
      }

      try {
        res.status(200).json(adapter.build())
      } catch (err) {
        // build() throws if an error event was captured
        const { status, body: errBody } = formatOAIError(err)
        res.status(status).json(errBody)
      }
    }
  },
}
