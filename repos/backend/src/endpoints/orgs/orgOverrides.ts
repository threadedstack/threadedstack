import type { TEndpointConfig } from '@TBE/types'

import { permissionOverrides } from '@TBE/endpoints/permissionOverrides/permissionOverrides'

export const orgOverrides: TEndpointConfig = {
  ...permissionOverrides,
  path: `/:orgId/overrides`,
}
