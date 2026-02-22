import type { Domain } from '@tdsk/domain'
import { domainsApi } from '@TAF/services'
import { upsertDomains } from '@TAF/actions/domains/local/upsertDomains'

export type TFetchDomainsOpts = {
  orgId: string
  projectId?: string
}

export const fetchDomains = async (opts: TFetchDomainsOpts) => {
  const { orgId, projectId } = opts
  const resp = await domainsApi.list(orgId, projectId)

  if (resp.error) return resp

  const domainsMap =
    resp.data?.reduce((acc: Record<string, Domain>, domain: Domain) => {
      acc[domain.id] = domain
      return acc
    }, {}) || {}

  const contextKey = projectId || 'org'
  upsertDomains(contextKey, domainsMap)

  return { ...resp, data: domainsMap }
}
