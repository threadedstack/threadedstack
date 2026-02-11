import { nav } from '@TAF/services/nav'
import { setActiveOrgId, getActiveOrgId } from '@TAF/state/accessors'
import { unsetActiveProject } from '@TAF/actions/projects/local/unsetActiveProject'

export const setOrgActive = (
  orgId: string,
  navigate: boolean = true,
  force?: boolean
) => {
  const current = getActiveOrgId()
  if (force || current !== orgId) {
    unsetActiveProject()
    setActiveOrgId(orgId)
  }

  if (navigate) orgId ? nav.to(`/orgs/${orgId}/projects`) : nav.to(`/orgs`)
}
