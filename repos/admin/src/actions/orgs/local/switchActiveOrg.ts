import { nav } from '@TAF/services/nav'
import { setActiveOrgId, resetActiveProjectId } from '@TAF/state/accessors'

export const switchActiveOrg = (orgId?: string, navigate?: boolean) => {
  resetActiveProjectId()
  orgId && setActiveOrgId(orgId)
  navigate && nav.to(`/orgs/${orgId}`)
}
