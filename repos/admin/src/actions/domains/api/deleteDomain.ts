import { domainsApi } from '@TAF/services'
import { removeDomain } from '@TAF/actions/domains/local/removeDomain'

export type TDeleteDomainOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteDomain = async (opts: TDeleteDomainOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await domainsApi.delete(orgId, id, projectId)

  if (resp.error) return resp
  const contextKey = projectId || 'org'
  removeDomain(contextKey, id)

  return resp
}
