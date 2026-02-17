import type { TEndpointConfig } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { streamChat } from './streamChat'

/**
 * AI stream group — mounted at /ai (top level, no auth middleware)
 *
 * POST /ai/stream — session-token auth only (validated in handler)
 *   Proxies LLM calls using pi-ai, streams ProxyAssistantMessageEvent via SSE
 *
 * The /_/ai/sessions endpoint is registered under accounts (which has auth)
 */
export const aiStream: TEndpointConfig = {
  path: `/ai`,
  method: EPMethod.Use,
  middleware: [express.json()],
  endpoints: {
    streamChat,
  },
}
