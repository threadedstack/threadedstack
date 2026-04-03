import type { Organization } from '@tdsk/domain'

import { orgsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

export type TCreateOrgInput = {
  name: string
  description?: string
}

export type TCreateOrgResult = {
  org?: Organization
  error?: Error
}

export const createOrg = async (input: TCreateOrgInput): Promise<TCreateOrgResult> => {
  const resp = await orgsApi.create(input)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const currentOrgs = getOrgs() || {}
    setOrgs({ ...currentOrgs, [resp.data.id]: resp.data })
    query.client.invalidateQueries({ queryKey: orgsApi.cache.list() })
  }

  return { org: resp.data }
}
