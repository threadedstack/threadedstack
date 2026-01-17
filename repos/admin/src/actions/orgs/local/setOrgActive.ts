import { nav } from '@TAF/services/nav'
import { setActiveOrgId, resetActiveProjectId } from '@TAF/state/accessors'

export const setOrgActive = (orgId?: string, navigate: boolean = true) => {
  resetActiveProjectId()
  orgId && setActiveOrgId(orgId)
  navigate && nav.to(`/orgs/${orgId}`)
}
