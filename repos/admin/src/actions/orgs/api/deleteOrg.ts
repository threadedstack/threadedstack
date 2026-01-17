import { orgsApi } from '@TAF/services'
import { nav } from '@TAF/services/nav'
import { setOrgs, getOrgs, getActiveOrgId, setActiveOrgId } from '@TAF/state/accessors'

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

  const activeId = getActiveOrgId()
  if (activeId === id) {
    setActiveOrgId(undefined)
    nav.home()
  }

  return { success: true }
}
