import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getProvider } from '@TBE/endpoints/providers/getProvider'
import { listProviders } from '@TBE/endpoints/providers/listProviders'
import { createProvider } from '@TBE/endpoints/providers/createProvider'
import { updateProvider } from '@TBE/endpoints/providers/updateProvider'
import { deleteProvider } from '@TBE/endpoints/providers/deleteProvider'

export const orgProviders: TEndpointConfig = {
  path: `/:orgId/providers`,
  method: EPMethod.Use,
  endpoints: {
    getProvider,
    listProviders,
    createProvider,
    updateProvider,
    deleteProvider,
  },
}
