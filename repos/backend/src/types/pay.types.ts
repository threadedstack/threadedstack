import type { Exception, Plan } from '@tdsk/domain'

export enum EPayType {
  stripe = `stripe`,
  console = `console`,
}

export type TPayType = `${EPayType}`

export type TPayEnv =
  | `sandbox`
  | `ci`
  | `test`
  | `local`
  | `develop`
  | `staging`
  | `production`

export type TPayConfig = {
  type?: TPayType
  secretKey: string
  webhookSecret: string
  environment?: TPayEnv
  priceIds: Record<string, string>
  seatPriceIds: Record<string, string>
}

export type TPayCustomer = {
  id: string
  email: string
  metadata?: Record<string, string>
}

export type TPayCheckoutSession = {
  id: string
  url: string
  customer_id: string
}

export type TPayPortalSession = {
  url: string
}

export type TPaySubscriptionState = {
  tier: string
  status: string
  stripePriceId: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart?: string
}

export type TPlanResp = { data?: Plan[]; error?: Exception }
