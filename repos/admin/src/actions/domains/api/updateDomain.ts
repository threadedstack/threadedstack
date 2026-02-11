import type { Domain } from '@tdsk/domain'

import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TUpdateDomainOpts = {
  orgId: string
  id: string
  data: Partial<Domain>
  projectId?: string
}

export const updateDomain = async (opts: TUpdateDomainOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await domainsApi.update(orgId, id, data, projectId)

  if (resp.error) return resp
  resp.data && upsertDomain(resp.data)

  return resp
}
