import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { nanoid } from 'nanoid'
import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireAgentAccess } from '@TBE/utils/auth/requireAgentAccess'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'
import {
  extractPrompt,
  buildOverrides,
  convertOAIMessages,
} from '@TBE/services/openai/requestAdapter'
import {
  formatOAIError,
  createStreamingAdapter,
  createNonStreamingAdapter,
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
 *
 * A caller continuing an existing conversation can pass `threadId` in the
 * request body (or an `X-Thread-Id` header) to reuse that thread instead —
 * thread-create and message-reseed are both skipped in that case.
 */
export const oaiChatCompletions: TEndpointConfig = {
  path: `/:id/v1/chat/completions`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const agentId = req.params.id
    const userId = req.user?.id
    const body = req.body

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: agentData, error: agentFetchErr } = await db.services.agent.get(agentId)
    if (agentFetchErr) {
      const { status, body: errBody } = formatOAIError(
        new Exception(500, agentFetchErr.message)
      )
      res.status(status).json(errBody)
      return
    }
    if (!agentData) {
      const { status, body: errBody } = formatOAIError(
        new Exception(404, `Agent not found`)
      )
      res.status(status).json(errBody)
      return
    }

    try {
      await requireAgentAccess(req, agentId, agentData.orgId, agentData)
    } catch (err) {
      const { status, body: errBody } = formatOAIError(err)
      res.status(status).json(errBody)
      return
    }

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
    const modelName = body.model || `default`
    const completionId = `chatcmpl-${nanoid(24)}`

    const agent = new AgentEndpoint()

    // Resolve agent config once — replaces separate agent.get call and
    // avoids double-resolution when runHeadless is called later.
    let config
    try {
      config = await resolveAgentConfig(agentId, db, req.app, {
        userId,
        overrides,
      })
    } catch (err) {
      const { status, body: errBody } = formatOAIError(err)
      res.status(status).json(errBody)
      return
    }

    // Reuse an existing thread when the caller supplies one (body `threadId`
    // or `X-Thread-Id` header) — skips thread-create + message-reseed entirely.
    let threadId: string | undefined
    const incomingThreadId: string | undefined =
      body.threadId || (req.headers[`x-thread-id`] as string | undefined)
    if (incomingThreadId) {
      const { data: existingThread, error: threadFetchErr } =
        await db.services.thread.get(incomingThreadId)
      if (
        threadFetchErr ||
        !existingThread ||
        existingThread.orgId !== agentData.orgId ||
        existingThread.agentId !== agentId ||
        existingThread.userId !== userId
      ) {
        const { status, body: errBody } = formatOAIError(
          new Exception(400, `Invalid threadId for this agent`)
        )
        res.status(status).json(errBody)
        return
      }
      threadId = existingThread.id
    }

    // Seed thread with prior messages if conversation has history.
    // Skipped entirely when reusing an existing thread supplied above.
    const priorMessages = body.messages.slice(0, -1)
    if (!threadId && priorMessages.length) {
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
                error: msgErr.message,
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
      res.setHeader(`Connection`, `keep-alive`)
      res.setHeader(`Cache-Control`, `no-cache`)
      res.setHeader(`Content-Type`, `text/event-stream`)
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
          agentId,
          threadId,
          error: err instanceof Error ? err : message,
          stack: err instanceof Error ? err.stack : undefined,
        })
        if (!aborted) {
          res.write(
            `data: ${JSON.stringify({
              error: { message, type: `server_error`, param: null, code: null },
            })}\n\n`
          )
        }
      }

      !aborted && adapter.finish()
    } else {
      // Non-streaming mode — collect events, return JSON
      const adapter = createNonStreamingAdapter(completionId, modelName)

      try {
        await agent.runHeadless(req, db, {
          prompt,
          userId,
          agentId,
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
