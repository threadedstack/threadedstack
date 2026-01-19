import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getPlans } from './getPlans'
import { createCheckout } from './createCheckout'
import { createPortalSession } from './createPortalSession'
import { getCurrentSubscription } from './getCurrentSubscription'
import { cancelSubscription } from './cancelSubscription'

export const subscriptions: TEndpointConfig = {
  path: `/subscriptions`,
  method: EPMethod.Use,
  endpoints: {
    getPlans,
    getCurrentSubscription,
    createCheckout,
    createPortalSession,
    cancelSubscription,
  },
}
