import { orgsApi } from '@TAF/services'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

export type TDeleteOrgResult = {
  success?: boolean
  error?: Error
}

export const deleteOrg = async (id: string): Promise<TDeleteOrgResult> => {
  const resp = await orgsApi.delete(id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove org from state
  const currentOrgs = getOrgs() || {}
  const { [id]: removed, ...remainingOrgs } = currentOrgs
  setOrgs(remainingOrgs)

  return { success: true }
}
