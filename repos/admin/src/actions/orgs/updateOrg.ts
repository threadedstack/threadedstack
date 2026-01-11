import type { Organization } from '@tdsk/domain'

import { orgsApi } from '@TAF/services'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

export type TUpdateOrgInput = {
  name?: string
  description?: string
}

export type TUpdateOrgResult = {
  error?: Error
  org?: Organization
}

export const updateOrg = async (
  id: string,
  input: TUpdateOrgInput
): Promise<TUpdateOrgResult> => {
  const resp = await orgsApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update orgs state with the updated org
    const currentOrgs = getOrgs() || {}
    setOrgs({ ...currentOrgs, [resp.data.id]: resp.data })
  }

  return { org: resp.data }
}
