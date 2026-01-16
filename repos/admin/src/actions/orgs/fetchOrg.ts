import type { Organization } from '@tdsk/domain'

import { orgsApi } from '@TAF/services'
import { setOrgs, getOrgs, setActiveOrgRole } from '@TAF/state/accessors'

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
    const currentOrgs = getOrgs() || {}
    setOrgs({ ...currentOrgs, [resp.data.id]: resp.data })

    // Set the active org role if it's provided by the backend
    if (`userRole` in resp.data && resp.data.userRole)
      setActiveOrgRole(resp.data.userRole as string)
  }

  return { org: resp.data }
}
