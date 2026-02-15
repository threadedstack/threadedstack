import type { TEndpointConfig } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { aiChatProxy } from './chatProxy'

/**
 * AI chat endpoint group — mounted at /ai (top level, no auth middleware)
 *
 * POST /ai/chat — session-token auth only (validated in handler)
 *
 * The /ai/sessions endpoint is registered under accounts (which has auth)
 */
export const ai: TEndpointConfig = {
  path: `/ai`,
  method: EPMethod.Use,
  middleware: [express.json()],
  endpoints: {
    chatProxy: aiChatProxy,
  },
}
