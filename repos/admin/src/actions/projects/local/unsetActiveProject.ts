import { nav } from '@TAF/services/nav'
import { resetProjects, getActiveOrgId, resetActiveProjectId } from '@TAF/state/accessors'

export const unsetActiveProject = (navigate?: boolean) => {
  resetProjects()
  resetActiveProjectId()
  if (!navigate) return

  const orgId = getActiveOrgId()
  nav.to(`/orgs/${orgId}/projects`)
}
