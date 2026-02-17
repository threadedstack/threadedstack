import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { createSession } from './createSession'

/**
 * AI endpoint group — mounted under accounts at /_/ai
 * Inherits auth middleware from accounts parent (JWT/API key)
 *
 * POST /_/ai/sessions — create a new LLM session
 */
export const ai: TEndpointConfig = {
  path: `/ai`,
  method: EPMethod.Use,
  endpoints: {
    createSession,
  },
}
