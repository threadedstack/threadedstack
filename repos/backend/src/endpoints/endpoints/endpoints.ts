import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getEndpoint } from '@TBE/endpoints/endpoints/getEndpoint'
import { listEndpoints } from '@TBE/endpoints/endpoints/listEndpoints'
import { createEndpoint } from '@TBE/endpoints/endpoints/createEndpoint'
import { updateEndpoint } from '@TBE/endpoints/endpoints/updateEndpoint'
import { deleteEndpoint } from '@TBE/endpoints/endpoints/deleteEndpoint'

export const endpoints: TEndpointConfig = {
  path: `/endpoints`,
  method: EPMethod.Use,
  endpoints: {
    getEndpoint,
    listEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
  },
}
