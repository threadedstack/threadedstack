import { permissionOverridesApi } from '@TAF/services/permissionOverridesApi'
import { setOverrides } from '@TAF/actions/permissionOverrides/local/setOverrides'

export const fetchOverrides = async (orgId: string) => {
  const resp = await permissionOverridesApi.list(orgId)
  if (resp.error) return { error: resp.error }
  resp.data && setOverrides(resp.data)
  return resp
}
