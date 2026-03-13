import { subscriptionsApi } from '@TAF/services/subscriptionsApi'

/**
 * Create a portal session URL for managing subscription
 * @returns Portal session with redirect URL
 */
export const createPortalSession = async () => {
  return await subscriptionsApi.portal()
}
