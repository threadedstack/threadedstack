import type { TEndpointConfig } from '@TBE/types'

import { domains } from '@TBE/endpoints/domains/domains'

export const orgDomains: TEndpointConfig = {
  ...domains,
  path: `/:orgId/domains`,
}
