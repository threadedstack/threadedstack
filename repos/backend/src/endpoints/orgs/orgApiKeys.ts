import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'
import { getApiKey } from '@TBE/endpoints/apiKeys/getApiKey'
import { listApiKeys } from '@TBE/endpoints/apiKeys/listApiKeys'
import { deleteApiKey } from '@TBE/endpoints/apiKeys/deleteApiKey'
import { updateApiKey } from '@TBE/endpoints/apiKeys/updateApiKey'
import { createApiKey } from '@TBE/endpoints/apiKeys/createApiKey'

export const orgApiKeys: TEndpointConfig = {
  path: `/:orgId/api-keys`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    getApiKey,
    listApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
  },
}
