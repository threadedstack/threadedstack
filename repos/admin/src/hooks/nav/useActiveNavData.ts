import type { TNavCtx } from '@TAF/types'
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

  return useMemo<TNavCtx>(
    () => ({
      orgId: activeOrgId,
      projectId: activeProjectId,
      org: activeOrgId && orgs?.[activeOrgId],
      project: activeProjectId && projects?.[activeProjectId],
    }),
    [orgs, projects, activeOrgId, activeProjectId]
  )
}
