import type { Domain } from '@tdsk/domain'
import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TCreateDomainOpts = {
  orgId: string
  data: Partial<Domain>
  projectId?: string
}

export const createDomain = async (opts: TCreateDomainOpts) => {
  const { orgId, data, projectId } = opts
  const resp = await domainsApi.create(orgId, data, projectId)

  if (resp.error) return resp
  const contextKey = projectId || 'org'
  resp.data && upsertDomain(contextKey, resp.data)

  return resp
}
