import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { domains } from '@TBE/endpoints/domains/domains'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgDomains: TEndpointConfig = {
  ...domains,
  path: `/:orgId/domains`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
}
