import { subscriptionsApi } from '@TAF/services/subscriptionsApi'

/**
 * Create a portal session URL for managing subscription
 * @returns Portal session with redirect URL
 */
export const createPortalSession = async () => {
  const resp = await subscriptionsApi.portal()

  return resp
}
