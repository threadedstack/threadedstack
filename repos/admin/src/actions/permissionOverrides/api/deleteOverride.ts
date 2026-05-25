import { query } from '@TAF/services/query'
import { permissionOverridesApi } from '@TAF/services/permissionOverridesApi'
import { getPermissionOverrides, setPermissionOverrides } from '@TAF/state/accessors'

export type TDeleteOverrideOpts = {
  orgId: string
  overrideId: string
}

export const deleteOverride = async (opts: TDeleteOverrideOpts) => {
  const { orgId, overrideId } = opts
  const resp = await permissionOverridesApi.remove(orgId, overrideId)

  if (resp.error) return { error: resp.error }

  const current = getPermissionOverrides() || []
  setPermissionOverrides(current.filter((o) => o.id !== overrideId))
  query.client.invalidateQueries({ queryKey: permissionOverridesApi.cache.all() })
  query.client.removeQueries({
    queryKey: permissionOverridesApi.cache.detail(overrideId),
  })

  return resp
}
