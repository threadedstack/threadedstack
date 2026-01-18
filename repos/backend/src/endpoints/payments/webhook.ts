import type { TEndpointBuilder } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Webhooks } from '@polar-sh/express'
import { onPolarWebhook } from '@TBE/services/payments/polar'

export const webhook: TEndpointBuilder = (config) => {
  return {
    path: `/webhooks`,
    method: EPMethod.Post,
    action: Webhooks({
      webhookSecret: config.payments.wbhSecret,
      onPayload: async (payload) => {
        await onPolarWebhook(payload)
      },
    }),
  }
}
