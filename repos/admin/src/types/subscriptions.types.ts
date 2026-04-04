import type { TSubscriptionTier } from '@tdsk/domain'

/**
 * Checkout data structure for creating a checkout session
 */
export type TCheckoutData = {
  tier: TSubscriptionTier
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
