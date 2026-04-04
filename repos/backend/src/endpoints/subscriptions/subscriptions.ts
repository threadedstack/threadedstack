import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getPlans } from './getPlans'
import { getInvoices } from './getInvoices'
import { createCheckout } from './createCheckout'
import { updateSubscription } from './updateSubscription'
import { createPortalSession } from './createPortalSession'
import { getCurrentSubscription } from './getCurrentSubscription'
import { cancelSubscription } from './cancelSubscription'

export const subscriptions: TEndpointConfig = {
  path: `/subscriptions`,
  method: EPMethod.Use,
  endpoints: {
    getPlans,
    getInvoices,
    createCheckout,
    updateSubscription,
    cancelSubscription,
    createPortalSession,
    getCurrentSubscription,
  },
}
