import { quotasApi } from '@TAF/services/quotasApi'
import { setOrgQuota } from '@TAF/actions/quotas/local/setOrgQuota'

/**
 * Fetch organization quota usage and update state
 * @param orgId - Organization ID
 */
export const fetchOrgQuota = async (orgId: string) => {
  const resp = await quotasApi.get({ orgId })
  if (resp.error) return resp

  resp.data && setOrgQuota(resp.data)

  return resp
}
