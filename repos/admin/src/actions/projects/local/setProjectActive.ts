import { nav } from '@TAF/services/nav'
import {
  getActiveOrgId,
  getActiveProjectId,
  setActiveProjectId,
} from '@TAF/state/accessors'

export const setProjectActive = (
  projectId: string,
  navigate: boolean = true,
  force?: boolean
) => {
  const current = getActiveProjectId()
  if (force || current !== projectId) setActiveProjectId(projectId)

  if (!navigate) return

  const orgId = getActiveOrgId()
  nav.to(`/orgs/${orgId}/projects/${projectId}`)
}
