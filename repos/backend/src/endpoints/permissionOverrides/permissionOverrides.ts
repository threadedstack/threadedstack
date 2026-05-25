import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { listOverrides } from '@TBE/endpoints/permissionOverrides/listOverrides'
import { createOverride } from '@TBE/endpoints/permissionOverrides/createOverride'
import { updateOverride } from '@TBE/endpoints/permissionOverrides/updateOverride'
import { deleteOverride } from '@TBE/endpoints/permissionOverrides/deleteOverride'
import { cleanupOverrides } from '@TBE/endpoints/permissionOverrides/cleanupOverrides'

export const permissionOverrides: TEndpointConfig = {
  path: `/overrides`,
  method: EPMethod.Use,
  endpoints: {
    listOverrides,
    createOverride,
    updateOverride,
    deleteOverride,
    cleanupOverrides,
  },
}
