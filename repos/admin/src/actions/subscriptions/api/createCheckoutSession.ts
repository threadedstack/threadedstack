import type { TSubscriptionTier } from '@tdsk/domain'
import { subscriptionsApi } from '@TAF/services/subscriptionsApi'

/**
 * Create a checkout session for upgrading to a plan
 * @param tier - Subscription tier to upgrade to
 * @param successUrl - URL to redirect to on success
 * @param cancelUrl - URL to redirect to on cancellation
 */
export const createCheckoutSession = async (
  tier: TSubscriptionTier,
  successUrl?: string,
  cancelUrl?: string
) => {
  return await subscriptionsApi.checkout({ tier, successUrl, cancelUrl })
}
