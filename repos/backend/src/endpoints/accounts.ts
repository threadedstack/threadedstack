import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { adminPath } from '@tdsk/domain'
import { teams } from '@TBE/endpoints/teams'
import { users } from '@TBE/endpoints/users'
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { health } from '@TBE/endpoints/base/health'
import { authenticate } from '@TBE/middleware/setupAuth'

export const accounts: TEndpointBuilder = (config) => {
  return {
    method: EPMethod.Use,
    path: adminPath(config.server),
    middleware: [express.json(), authenticate],
    endpoints: {
      auth,
      base,
      users,
      teams,
      health,
    },
  }
}
