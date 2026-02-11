import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkQuota } from '@TBE/endpoints/quotas/checkQuota'
import { getOrgQuota } from '@TBE/endpoints/quotas/getOrgQuota'
import { getOrgLimits } from '@TBE/endpoints/quotas/getOrgLimits'

export const orgQuotas: TEndpointConfig = {
  path: `/:orgId/quotas`,
  method: EPMethod.Use,
  endpoints: {
    checkQuota,
    getOrgQuota,
    getOrgLimits,
  },
}
