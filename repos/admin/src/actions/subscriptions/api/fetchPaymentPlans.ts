import { setPaymentPlans } from '@TAF/state/accessors'
import { subscriptionsApi } from '@TAF/services/subscriptionsApi'

/**
 * Fetch available payment plans and update state
 */
export const fetchPaymentPlans = async () => {
  const resp = await subscriptionsApi.plans()
  resp.data && setPaymentPlans(resp.data)

  return resp
}
