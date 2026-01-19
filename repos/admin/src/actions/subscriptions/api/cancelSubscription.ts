import { store } from '@TAF/state'
import { subscriptionsApi } from '@TAF/services/subscriptionsApi'
import { currentSubscriptionState } from '@TAF/state/subscriptions'

/**
 * Cancel current subscription
 * Updates local state to reflect cancellation
 */
export const cancelSubscription = async () => {
  const resp = await subscriptionsApi.cancel()

  if (resp.data?.success) {
    // Refresh subscription to get updated cancelAtPeriodEnd flag
    const currentResp = await subscriptionsApi.current()
    if (currentResp.data) {
      store.set(currentSubscriptionState, currentResp.data)
    }
  }

  return resp
}
