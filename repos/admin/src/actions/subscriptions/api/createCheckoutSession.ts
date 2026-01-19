import { subscriptionsApi } from '@TAF/services/subscriptionsApi'

/**
 * Create a checkout session for upgrading to a plan
 * @param planId - Plan ID to upgrade to
 * @param successUrl - URL to redirect to on success
 * @param cancelUrl - URL to redirect to on cancellation
 */
export const createCheckoutSession = async (
  planId: string,
  successUrl?: string,
  cancelUrl?: string
) => {
  const resp = await subscriptionsApi.checkout({
    planId,
    successUrl,
    cancelUrl,
  })

  return resp
}
