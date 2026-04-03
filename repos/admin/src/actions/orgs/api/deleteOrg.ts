import { orgsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { unsetActiveOrg } from '@TAF/actions/orgs/local/unsetActiveOrg'
import { setOrgs, getOrgs, getActiveOrgId } from '@TAF/state/accessors'

export type TDeleteOrgResult = {
  success?: boolean
  error?: Error
}

export const deleteOrg = async (id: string): Promise<TDeleteOrgResult> => {
  const resp = await orgsApi.delete(id)

  if (resp.error) return { error: resp.error }

  const currentOrgs = getOrgs() || {}
  const { [id]: removed, ...remainingOrgs } = currentOrgs
  setOrgs(remainingOrgs)

  const activeId = getActiveOrgId()
  if (activeId === id) unsetActiveOrg()

  query.client.invalidateQueries({ queryKey: orgsApi.cache.list() })
  query.client.removeQueries({ queryKey: orgsApi.cache.detail(id) })

  return { success: true }
}
