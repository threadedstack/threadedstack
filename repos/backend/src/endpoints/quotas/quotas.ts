import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkQuota } from './checkQuota'
import { getOrgQuota } from './getOrgQuota'
import { getOrgLimits } from './getOrgLimits'

export const quotas: TEndpointConfig = {
  path: `/quotas`,
  method: EPMethod.Use,
  endpoints: {
    checkQuota,
    getOrgQuota,
    getOrgLimits,
  },
}
