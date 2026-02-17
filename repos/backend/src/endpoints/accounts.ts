import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { adminPath } from '@tdsk/domain'
import { orgs } from '@TBE/endpoints/orgs'
import { users } from '@TBE/endpoints/users'
import { payments } from './payments/payments'
import { ai } from '@TBE/endpoints/ai'
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { health } from '@TBE/endpoints/base/health'
import { invitations } from './invitations/invitations'
import { authenticate } from '@TBE/middleware/setupAuth'
import { subscriptions } from '@TBE/endpoints/subscriptions'
import { setupSubscription } from '@TBE/middleware/setupSubscription'

export const accounts: TEndpointBuilder = (app) => {
  return {
    method: EPMethod.Use,
    path: adminPath(app.locals.config.server),
    middleware: [express.json(), authenticate, setupSubscription],
    endpoints: {
      ai,
      auth,
      base,
      orgs,
      users,
      health,
      payments,
      invitations,
      subscriptions,
    },
  }
}
