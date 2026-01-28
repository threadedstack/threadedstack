import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getDomain } from '@TBE/endpoints/domains/getDomain'
import { listDomains } from '@TBE/endpoints/domains/listDomains'
import { createDomain } from '@TBE/endpoints/domains/createDomain'
import { updateDomain } from '@TBE/endpoints/domains/updateDomain'
import { deleteDomain } from '@TBE/endpoints/domains/deleteDomain'

export const domains: TEndpointConfig = {
  path: `/domains`,
  method: EPMethod.Use,
  endpoints: {
    getDomain,
    listDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  },
}
