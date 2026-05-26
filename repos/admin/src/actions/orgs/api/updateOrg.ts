import type { Organization } from '@tdsk/domain'

import { orgsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

export type TUpdateOrgResult = {
  error?: Error
  org?: Organization
}

export const updateOrg = async (
  id: string,
  input: Partial<Organization>
): Promise<TUpdateOrgResult> => {
  const resp = await orgsApi.update(id, input)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const currentOrgs = getOrgs() || {}
    const merged = { ...currentOrgs[id], ...resp.data }
    setOrgs({ ...currentOrgs, [resp.data.id]: merged })
    query.client.invalidateQueries({ queryKey: orgsApi.cache.list() })
    query.updateDetailCache(orgsApi.cache.detail(id), merged)
  }

  return { org: resp.data }
}
