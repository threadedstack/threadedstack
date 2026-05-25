import type { PermissionOverride } from '@tdsk/domain'

import { query } from '@TAF/services/query'
import { permissionOverridesApi } from '@TAF/services/permissionOverridesApi'
import { getPermissionOverrides, setPermissionOverrides } from '@TAF/state/accessors'

export type TCreateOverrideOpts = {
  orgId: string
  data: Omit<PermissionOverride, `id` | `grantedBy`>
}

export const createOverride = async (opts: TCreateOverrideOpts) => {
  const { orgId, data } = opts
  const resp = await permissionOverridesApi.create(orgId, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const current = getPermissionOverrides() || []
    setPermissionOverrides([...current, resp.data])
    query.client.invalidateQueries({ queryKey: permissionOverridesApi.cache.all() })
  }

  return resp
}
