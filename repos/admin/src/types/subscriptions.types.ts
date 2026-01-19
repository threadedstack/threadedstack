import type { TPayPlanMeta } from '@tdsk/domain'

/**
 * Subscription data structure
 */
export type TSubscriptionData = {
  userId: string
  tier: string
  status: string
  polarId?: string
  polarPriceId?: string
  polarCustomerId?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
}

/**
 * Payment plan data structure
 */
export type TPlanData = {
  id: string
  name: string
  metadata: TPayPlanMeta
}

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
