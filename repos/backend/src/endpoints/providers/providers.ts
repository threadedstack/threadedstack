import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getProvider } from '@TBE/endpoints/providers/getProvider'
import { fetchModels } from '@TBE/endpoints/providers/fetchModels'
import { listProviders } from '@TBE/endpoints/providers/listProviders'
import { createProvider } from '@TBE/endpoints/providers/createProvider'
import { updateProvider } from '@TBE/endpoints/providers/updateProvider'
import { deleteProvider } from '@TBE/endpoints/providers/deleteProvider'

/**
 * This endpoint is exposed at `/_/providers` because it does not need to be organization scoped
 * Currently only the `/:brand/models` endpoint exists but others may be needed in the future
 */
export const providerModels = {
  path: `/providers`,
  method: EPMethod.Use,
  endpoints: {
    fetchModels,
  },
}

export const providers: TEndpointConfig = {
  path: `/providers`,
  method: EPMethod.Use,
  endpoints: {
    fetchModels,
    getProvider,
    listProviders,
    createProvider,
    updateProvider,
    deleteProvider,
  },
}
