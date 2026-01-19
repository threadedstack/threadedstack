import { quotasApi } from '@TAF/services/quotasApi'
import { setOrgLimits } from '@TAF/state/accessors'

/**
 * Fetch organization quota limits (from plan) and update state
 * @param orgId - Organization ID
 */
export const fetchOrgLimits = async (orgId: string) => {
  const resp = await quotasApi.limits({ orgId })
  resp.data && setOrgLimits(resp.data)

  return resp
}
