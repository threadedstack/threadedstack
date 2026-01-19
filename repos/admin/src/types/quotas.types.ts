/**
 * Quota usage data structure
 */
export type TQuotaData = {
  orgId: string
  period: string
  price?: number
  retention?: number
  organizations?: number
  projects?: number
  members?: number
  endpoints?: number
  threads?: number
  messages?: number
  functionCalls?: number
  runtime?: number
  orgSecrets?: number
  projectSecrets?: number
}

/**
 * Quota limits data structure (from plan)
 */
export type TLimitsData = {
  price?: number
  runtime?: number
  retention?: number
  threads?: number
  members?: number
  functionCalls?: number
  messages?: number
  projects?: number
  endpoints?: number
  orgSecrets?: number
  organizations?: number
  projectSecrets?: number
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
  allowed: boolean
  current: number
  limit: number
  remaining: number
}
