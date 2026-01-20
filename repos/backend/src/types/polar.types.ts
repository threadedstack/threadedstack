import type { Exception } from '@TBE/utils/errors/exception'
import type { Plan, TPayPlanMeta, TPayPlanRaw } from '@tdsk/domain'

export type TPolarConfig = {
  token: string
  url: string
  wbhSecret: string
  plans: Record<string, string>
}

export type TPolarProduct = {
  id: string
  name: string
  metadata: TPayPlanRaw
}

export type TPolarCustomer = {
  id: string
  email: string
  metadata?: Record<string, string>
}

export type TPolarCheckoutSession = {
  id: string
  url: string
  customer_id: string
}

export type TPolarPortalSession = {
  url: string
}

export type TPlanResp = { data?: Plan[]; error?: Exception }
