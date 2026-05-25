import type { PermissionOverride } from '@tdsk/domain'

import { query } from '@TAF/services/query'
import { permissionOverridesApi } from '@TAF/services/permissionOverridesApi'
import { getPermissionOverrides, setPermissionOverrides } from '@TAF/state/accessors'

export type TUpdateOverrideOpts = {
  orgId: string
  overrideId: string
  data: Partial<Pick<PermissionOverride, `effect` | `reason` | `expiresAt`>>
}

export const updateOverride = async (opts: TUpdateOverrideOpts) => {
  const { orgId, overrideId, data } = opts
  const resp = await permissionOverridesApi.update(orgId, overrideId, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const current = getPermissionOverrides() || []
    setPermissionOverrides(
      current.map((o) => (o.id === overrideId ? { ...o, ...resp.data } : o))
    )
    query.client.invalidateQueries({
      queryKey: permissionOverridesApi.cache.all(),
    })
  }

  return resp
}
