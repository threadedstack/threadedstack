import type { TPayPlanMeta } from '@tdsk/domain'

export type TLimitsData = Partial<TPayPlanMeta>

export type TQuotaData = Partial<TPayPlanMeta> & {
  orgId: string
  period: string
}

/**
 * Check quota data structure
 */
export type TCheckQuotaData = {
  orgId: string
  resource: string
  amount?: number
}

/**
 * Quota check result
 */
export type TQuotaCheckResult = {
  limit: number
  current: number
  allowed: boolean
  remaining: number
}
