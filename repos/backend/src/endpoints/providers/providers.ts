import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getProvider } from '@TBE/endpoints/providers/getProvider'
import { fetchModels } from '@TBE/endpoints/providers/fetchModels'
import { listProviders } from '@TBE/endpoints/providers/listProviders'
import { createProvider } from '@TBE/endpoints/providers/createProvider'
import { updateProvider } from '@TBE/endpoints/providers/updateProvider'
import { deleteProvider } from '@TBE/endpoints/providers/deleteProvider'

/**
 * Aggregator used by unit tests for convenient access to all provider
 * endpoints. The real mount point in production is `orgProviders` at
 * `/_/orgs/:orgId/providers` (see `repos/backend/src/endpoints/orgs/orgProviders.ts`).
 * This export is intentionally not registered in `accounts.ts`.
 */
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
