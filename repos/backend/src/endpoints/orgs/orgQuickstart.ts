import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { quickstart } from '@TBE/endpoints/orgs/quickstart'

export const orgQuickstart: TEndpointConfig = {
  path: `/:orgId/quickstart`,
  method: EPMethod.Use,
  endpoints: {
    quickstart,
  },
}
