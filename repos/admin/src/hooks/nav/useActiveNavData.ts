import { useMemo } from 'react'
import {
  useOrgs,
  useProjects,
  useActiveOrgId,
  useActiveProjectId,
} from '@TAF/state/selectors'

export const useActiveNavData = () => {
  const [orgs] = useOrgs()
  const [projects] = useProjects()
  const [activeOrgId] = useActiveOrgId()
  const [activeProjectId] = useActiveProjectId()

  return useMemo(
    () => ({
      orgId: activeOrgId,
      org: activeOrgId && orgs?.[activeOrgId],
      projectId: activeProjectId,
      project: activeProjectId && projects?.[activeProjectId],
    }),
    [orgs, projects, activeOrgId, activeProjectId]
  )
}
