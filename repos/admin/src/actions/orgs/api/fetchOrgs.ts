import { orgsApi } from '@TAF/services'
import { setOrgs, setActiveOrgRole, getActiveOrgId } from '@TAF/state/accessors'

export const fetchOrgs = async () => {
  const resp = await orgsApi.list()

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    setOrgs(resp.data)

    // If there's an active org, update its role from the fetched data
    const activeOrgId = getActiveOrgId()
    if (activeOrgId && resp.data[activeOrgId]) {
      const activeOrg = resp.data[activeOrgId]
      if (`userRole` in activeOrg && activeOrg.userRole)
        setActiveOrgRole(activeOrg.userRole as string)
    }
  }

  return resp
}
