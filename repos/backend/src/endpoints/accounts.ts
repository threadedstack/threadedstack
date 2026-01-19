import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { adminPath } from '@tdsk/domain'
import { orgs } from '@TBE/endpoints/orgs'
import { users } from '@TBE/endpoints/users'
import { quotas } from '@TBE/endpoints/quotas'
import { payments } from './payments/payments'
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { secrets } from '@TBE/endpoints/secrets'
import { apiKeys } from '@TBE/endpoints/apiKeys'
import { projects } from '@TBE/endpoints/projects'
import { health } from '@TBE/endpoints/base/health'
import { authenticate } from '@TBE/middleware/setupAuth'
import { subscriptions } from '@TBE/endpoints/subscriptions'
import { providers } from '@TBE/endpoints/providers/providers'
import { endpoints } from '@TBE/endpoints/endpoints/endpoints'
import { setupSubscription } from '@TBE/middleware/setupSubscription'

export const accounts: TEndpointBuilder = (app) => {
  return {
    method: EPMethod.Use,
    path: adminPath(app.locals.config.server),
    middleware: [express.json(), authenticate, setupSubscription],
    endpoints: {
      auth,
      base,
      orgs,
      users,
      health,
      quotas,
      apiKeys,
      secrets,
      payments,
      projects,
      providers,
      endpoints,
      subscriptions,
    },
  }
}
