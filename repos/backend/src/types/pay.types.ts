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

export type TStripeConfig = {
  type?: TPayType
  secretKey: string
  webhookSecret: string
  priceIds: Record<string, string>
  seatPriceIds: Record<string, string>
  environment?: TPayEnv
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

export type TPlanResp = { data?: Plan[]; error?: Exception }
