import type { TEndpointBuilder } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Webhooks } from '@polar-sh/express'

export const webhook: TEndpointBuilder = (app) => {
  return {
    path: `/webhooks`,
    method: EPMethod.Post,
    action: Webhooks({
      webhookSecret: app.locals.config.payments.wbhSecret,
      onPayload: async (payload) => {
        await app.locals.payments.webhook(app, payload)
      },
    }),
  }
}
