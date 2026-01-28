import type { Domain } from '@tdsk/domain'

import { domainsApi } from '@TAF/services'
import { upsertDomains } from '@TAF/actions/domains/local/upsertDomains'

export type TFetchDomains = {
  orgId?: string
  projectId?: string
}

export const fetchDomains = async (filters?: TFetchDomains) => {
  const resp = await domainsApi.list(filters)

  if (resp.error) return resp

  const domainsMap =
    resp.data?.reduce((acc: Record<string, Domain>, domain: Domain) => {
      acc[domain.id] = domain
      return acc
    }, {}) || {}

  upsertDomains(domainsMap)

  return { ...resp, data: domainsMap }
}
