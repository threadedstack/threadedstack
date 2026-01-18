import { toast } from 'sonner'
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
  !force && current === projectId
    ? toast.info(`Info`, { description: `Project is already active.` })
    : setActiveProjectId(projectId)

  if (!navigate) return

  const orgId = getActiveOrgId()
  nav.to(`/orgs/${orgId}/projects/${projectId}`)
}
