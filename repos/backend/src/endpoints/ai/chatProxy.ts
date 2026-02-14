import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getSession } from '@TBE/services/sessionStore'
import { llm } from '@TBE/services/llm'
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
 * POST /ai/chat - Proxy LLM calls using a session token
 *
 * The client sends messages and tools; the backend looks up the
 * cached session (which has the decrypted API key), creates
 * the real LLM adapter, and streams the response back via SSE.
 */
export const aiChatProxy: TEndpointConfig = {
  path: `/chat`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const token = extractSessionToken(req)
    if (!token) throw new Exception(401, `Session token required`)

    const session = getSession(token)
    if (!session) throw new Exception(401, `Invalid or expired session`)

    const { messages, tools = [] } = req.body
    if (!messages || !Array.isArray(messages)) {
      throw new Exception(400, `messages is required and must be an array`)
    }

    // Create the real LLM adapter (Anthropic/OpenAI/Google)
    const adapter = llm.createLLMAdapter(session.llmConfig.provider)

    // SSE headers
    res.setHeader(`Content-Type`, `text/event-stream`)
    res.setHeader(`Cache-Control`, `no-cache`)
    res.setHeader(`Connection`, `keep-alive`)
    res.flushHeaders()

    // Handle client disconnect
    let aborted = false
    req.on(`close`, () => {
      aborted = true
    })

    try {
      for await (const event of adapter.stream(messages, tools, session.llmConfig)) {
        if (aborted) break
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `LLM proxy error`
      logger.error(`Chat proxy error: ${message}`)
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: `error`, error: message })}\n\n`)
      }
    }

    if (!aborted) {
      res.write(`data: [DONE]\n\n`)
      res.end()
    }
  },
}
