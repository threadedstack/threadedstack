import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { permissionOverrides } from '@TBE/endpoints/permissionOverrides/permissionOverrides'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgOverrides: TEndpointConfig = {
  ...permissionOverrides,
  path: `/:orgId/overrides`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
}
