import { setCurrentSubscription } from '@TAF/state/accessors'
import { subscriptionsApi } from '@TAF/services/subscriptionsApi'

/**
 * Fetch current user's subscription and update state
 */
export const fetchCurrentSubscription = async () => {
  const resp = await subscriptionsApi.current()
  resp.data && setCurrentSubscription(resp.data)

  return resp
}
