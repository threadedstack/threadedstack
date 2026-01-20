import { subscriptionsApi } from '@TAF/services/subscriptionsApi'
import { setSubscription } from '@TAF/actions/subscriptions/local/setSubscription'

/**
 * Cancel current subscription
 * Updates local state to reflect cancellation
 */
export const cancelSubscription = async () => {
  const resp = await subscriptionsApi.cancel()
  if (resp.error) return resp

  if (resp.data?.success) {
    const currentResp = await subscriptionsApi.current()
    currentResp.data && setSubscription(currentResp.data)
  }

  return resp
}
