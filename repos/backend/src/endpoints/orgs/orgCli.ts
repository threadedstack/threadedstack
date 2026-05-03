import type { TEndpointConfig } from '@TBE/types'

import { cli } from '@TBE/endpoints/cli/cli'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgCli: TEndpointConfig = {
  ...cli,
  path: `/:orgId/cli`,
  middleware: [projectAccessGuard()],
}
