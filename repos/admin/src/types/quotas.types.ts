import type { TPlanLimits } from '@tdsk/domain'

export type TLimitsData = TPlanLimits

export type TQuotaData = {
  orgId: string
  period: string
  projects: number
  compute: number
  threads: number
  messages: number
  endpoints: number
  secrets: number
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
