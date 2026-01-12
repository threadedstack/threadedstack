import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { adminPath } from '@tdsk/domain'
import { orgs } from '@TBE/endpoints/orgs'
import { users } from '@TBE/endpoints/users'
import { apiKeys } from '@TBE/endpoints/apiKeys'
import { secrets } from '@TBE/endpoints/secrets'
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { health } from '@TBE/endpoints/base/health'
import { authenticate } from '@TBE/middleware/setupAuth'
import { endpoints } from '@TBE/endpoints/endpoints/endpoints'

export const accounts: TEndpointBuilder = (config) => {
  return {
    method: EPMethod.Use,
    path: adminPath(config.server),
    middleware: [express.json(), authenticate],
    endpoints: {
      auth,
      base,
      orgs,
      users,
      health,
      apiKeys,
      secrets,
      endpoints,
    },
  }
}
