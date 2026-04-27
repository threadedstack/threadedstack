import { nav } from '@TTH/services/nav'
import { getOrgId } from '@TTH/state/accessors'
import { isStr } from '@keg-hub/jsutils/isStr'
import { closeSidebar } from '@TTH/actions/sidebar/toggleSidebar'

export const goToProjects = (orgId?: unknown) => {
  const org = isStr(orgId) ? orgId : getOrgId()

  if (!org) return
  closeSidebar()
  nav.projects(org)
}
