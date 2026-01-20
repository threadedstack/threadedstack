import { subscriptionsApi } from '@TAF/services/subscriptionsApi'
import { setSubscription } from '@TAF/actions/subscriptions/local/setSubscription'

/**
 * Fetch current user's subscription and update state
 */
export const fetchCurrentSubscription = async () => {
  const resp = await subscriptionsApi.current()
  resp.data && setSubscription(resp.data)

  return resp
}
