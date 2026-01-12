import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getApiKey } from '@TBE/endpoints/apiKeys/getApiKey'
import { listApiKeys } from '@TBE/endpoints/apiKeys/listApiKeys'
import { deleteApiKey } from '@TBE/endpoints/apiKeys/deleteApiKey'
import { updateApiKey } from '@TBE/endpoints/apiKeys/updateApiKey'
import { createApiKey } from '@TBE/endpoints/apiKeys/createApiKey'

export const apiKeys: TEndpointConfig = {
  path: `/api-keys`,
  method: EPMethod.Use,
  endpoints: {
    getApiKey,
    listApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
  },
}
