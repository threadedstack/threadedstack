/**
 * Checkout data structure for creating a checkout session
 */
export type TCheckoutData = {
  planId: string
  successUrl?: string
  cancelUrl?: string
}

/**
 * Checkout session response
 */
export type TCheckoutSession = {
  id: string
  url: string
}

/**
 * Portal session response
 */
export type TPortalSession = {
  url: string
}
