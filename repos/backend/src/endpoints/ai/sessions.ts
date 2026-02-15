import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { aiCreateSession } from './createSession'

/**
 * AI sessions group — mounted under accounts at /_/ai
 * Inherits auth middleware from accounts parent (JWT/API key)
 *
 * POST /_/ai/sessions — create a new LLM session
 */
export const aiSessions: TEndpointConfig = {
  path: `/ai`,
  method: EPMethod.Use,
  endpoints: {
    createSession: aiCreateSession,
  },
}
