import { subscriptionsApi } from '@TAF/services/subscriptionsApi'
import { setPlans } from '@TAF/actions/subscriptions/local/setPlans'

/**
 * Fetch available payment plans and update state
 */
export const fetchPaymentPlans = async () => {
  const resp = await subscriptionsApi.plans()
  resp.data && setPlans(resp.data)

  return resp
}
