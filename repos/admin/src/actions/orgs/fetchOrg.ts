import type { Organization } from '@tdsk/domain'

import { orgsApi } from '@TAF/services'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

export type TFetchOrgResult = {
  error?: Error
  org?: Organization
}

export const fetchOrg = async (id: string): Promise<TFetchOrgResult> => {
  const resp = await orgsApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update orgs state with the fetched org
    const currentOrgs = getOrgs() || {}
    setOrgs({ ...currentOrgs, [resp.data.id]: resp.data })
  }

  return { org: resp.data }
}
