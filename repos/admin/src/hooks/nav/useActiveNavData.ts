import { useMemo } from 'react'
import {
  useOrgs,
  useProjects,
  useActiveOrgId,
  useActiveprojectId,
} from '@TAF/state/selectors'

export const useActiveNavData = () => {
  const [orgs] = useOrgs()
  const [projects] = useProjects()
  const [activeOrgId] = useActiveOrgId()
  const [activeprojectId] = useActiveprojectId()

  return useMemo(
    () => ({
      orgId: activeOrgId,
      org: activeOrgId && orgs?.[activeOrgId],
      projectId: activeprojectId,
      project: activeprojectId && projects?.[activeprojectId],
    }),
    [orgs, projects, activeOrgId, activeprojectId]
  )
}
