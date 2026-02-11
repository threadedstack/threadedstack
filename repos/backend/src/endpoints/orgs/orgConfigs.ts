import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getConfig } from '@TBE/endpoints/configs/getConfig'
import { listConfigs } from '@TBE/endpoints/configs/listConfigs'
import { createConfig } from '@TBE/endpoints/configs/createConfig'
import { updateConfig } from '@TBE/endpoints/configs/updateConfig'
import { deleteConfig } from '@TBE/endpoints/configs/deleteConfig'

export const orgConfigs: TEndpointConfig = {
  path: `/:orgId/configs`,
  method: EPMethod.Use,
  endpoints: {
    listConfigs,
    getConfig,
    createConfig,
    updateConfig,
    deleteConfig,
  },
}
