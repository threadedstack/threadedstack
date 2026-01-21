import type { Plan, TPayPlanRaw } from '@tdsk/domain'
import type { Exception } from '@TBE/utils/errors/exception'

export type TPolarConfig = {
  token: string
  url: string
  wbhSecret: string
  plans: Record<string, string>
}

export type TPolarProduct = {
  id: string
  name: string
  medias: any[]
  benefits: any[]
  modified_at?: string
  is_archived?: boolean
  description?: string
  metadata: TPayPlanRaw
  is_recurring?: boolean
  trial_interval?: string
  organization_id?: string
  prices: Record<string, any>
  recurring_interval?: string
  trial_interval_count?: number
  attached_custom_fields: any[]
  recurring_interval_count?: number
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
