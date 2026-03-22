import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { ai } from '@TBE/endpoints/ai'
import { adminPath } from '@tdsk/domain'
import { orgs } from '@TBE/endpoints/orgs'
import { users } from '@TBE/endpoints/users'
import { payments } from './payments/payments'
import { assets } from '@TBE/endpoints/assets'
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { health } from '@TBE/endpoints/base/health'
import { agents } from '@TBE/endpoints/agents/agents'
import { invitations } from './invitations/invitations'
import { authenticate } from '@TBE/middleware/setupAuth'
import { subscriptions } from '@TBE/endpoints/subscriptions'
import { providerModels } from '@TBE/endpoints/providers/providers'
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
      agents,
      assets,
      health,
      payments,
      invitations,
      subscriptions,
      providerModels,
    },
  }
}
