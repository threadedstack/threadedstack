import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { createSessionKey } from '@TBE/endpoints/cli/createSessionKey'
import { revokeSessionKey } from '@TBE/endpoints/cli/revokeSessionKey'

export const cli: TEndpointConfig = {
  path: `/cli`,
  method: EPMethod.Use,
  endpoints: {
    createSessionKey,
    revokeSessionKey,
  },
}
