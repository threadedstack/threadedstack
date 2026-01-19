import { setOrgQuota } from '@TAF/state/accessors'
import { quotasApi } from '@TAF/services/quotasApi'

/**
 * Fetch organization quota usage and update state
 * @param orgId - Organization ID
 */
export const fetchOrgQuota = async (orgId: string) => {
  const resp = await quotasApi.get({ orgId })
  resp.data && setOrgQuota(resp.data)

  return resp
}
