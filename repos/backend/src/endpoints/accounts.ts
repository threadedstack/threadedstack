import type { TEndpointBuilder } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { ai } from '@TBE/endpoints/ai'
import { adminPath } from '@tdsk/domain'
import { orgs } from '@TBE/endpoints/orgs'
import { users } from '@TBE/endpoints/users'
import { assets } from '@TBE/endpoints/assets'
import { base } from '@TBE/endpoints/base/base'
import { auth } from '@TBE/endpoints/auth/auth'
import { health } from '@TBE/endpoints/base/health'
import { agentOaiRoutes } from '@TBE/endpoints/agents/agents'
import { accessGate } from '@TBE/middleware/accessGate'
import { authenticate } from '@TBE/middleware/setupAuth'
import { payments } from '@TBE/endpoints/payments/payments'
import { subscriptions } from '@TBE/endpoints/subscriptions'
import { welcomeNewUser } from '@TBE/middleware/welcomeNewUser'
import { invitations } from '@TBE/endpoints/invitations/invitations'
import { setupSubscription } from '@TBE/middleware/setupSubscription'

/**
 * Wrapper for express.json() that captures the raw body buffer on the request
 * so that webhook signature verification can use the untouched payload.
 * The raw buffer is stored as `req.rawBody`.
 */
const jsonWithRawBody = express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf
  },
})

export const accounts: TEndpointBuilder = (app) => {
  return {
    method: EPMethod.Use,
    path: adminPath(app.locals.config.server),
    middleware: [
      jsonWithRawBody,
      authenticate,
      welcomeNewUser,
      accessGate,
      setupSubscription,
    ],
    endpoints: {
      ai,
      auth,
      base,
      orgs,
      users,
      agentOaiRoutes,
      assets,
      health,
      payments,
      invitations,
      subscriptions,
    },
  }
}
