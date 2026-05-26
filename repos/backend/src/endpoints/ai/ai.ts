import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { createSession } from './createSession'
import { featureGate } from '@TBE/middleware/featureGate'

export const ai: TEndpointConfig = {
  path: `/ai`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`)],
  endpoints: {
    createSession,
  },
}
