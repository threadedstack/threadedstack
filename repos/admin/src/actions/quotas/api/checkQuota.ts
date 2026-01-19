import type { TCheckQuotaData } from '@TAF/types'
import { quotasApi } from '@TAF/services/quotasApi'

/**
 * Check if a quota operation is allowed
 * @param data - Check quota data { orgId, resource, amount }
 * @returns Quota check result { allowed, current, limit, remaining }
 */
export const checkQuota = async (data: TCheckQuotaData) => {
  const resp = await quotasApi.check(data)

  return resp
}
