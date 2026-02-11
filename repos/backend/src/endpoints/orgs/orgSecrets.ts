import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getSecret } from '@TBE/endpoints/secrets/getSecret'
import { listSecrets } from '@TBE/endpoints/secrets/listSecrets'
import { updateSecret } from '@TBE/endpoints/secrets/updateSecret'
import { createSecret } from '@TBE/endpoints/secrets/createSecret'
import { deleteSecret } from '@TBE/endpoints/secrets/deleteSecret'

export const orgSecrets: TEndpointConfig = {
  path: `/:orgId/secrets`,
  method: EPMethod.Use,
  endpoints: {
    listSecrets,
    getSecret,
    createSecret,
    updateSecret,
    deleteSecret,
  },
}
