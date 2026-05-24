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
 * - New subscription: { id, url } - redirect to Stripe checkout
 * - In-place tier change: { updated: true, message }
 * - Downgrade to free: { cancelled: true, message }
 */
export type TCheckoutSession = {
  id?: string
  url?: string
  message?: string
  updated?: boolean
  cancelled?: boolean
}

/**
 * Portal session response
 */
export type TPortalSession = {
  url: string
}
