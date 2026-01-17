import { orgsApi } from '@TAF/services'
import { unsetActiveOrg } from '@TAF/actions/orgs/local/unsetActiveOrg'
import { setOrgs, getOrgs, getActiveOrgId } from '@TAF/state/accessors'

export type TDeleteOrgResult = {
  success?: boolean
  error?: Error
}

export const deleteOrg = async (id: string): Promise<TDeleteOrgResult> => {
  const resp = await orgsApi.delete(id)

  if (resp.error) return { error: resp.error }

  // Remove org from state
  const currentOrgs = getOrgs() || {}
  const { [id]: removed, ...remainingOrgs } = currentOrgs
  setOrgs(remainingOrgs)

  const activeId = getActiveOrgId()
  if (activeId === id) unsetActiveOrg()

  return { success: true }
}
