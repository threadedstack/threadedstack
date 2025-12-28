import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { base } from '@TBE/endpoints/auth/base'

export const auth: TEndpointConfig = {
  path: `/auth`,
  method: EPMethod.Use,
  endpoints: {
    base,
  },
}
