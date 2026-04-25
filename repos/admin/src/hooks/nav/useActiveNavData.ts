import type { TNavCtx } from '@TAF/types'
import { useMemo } from 'react'
import { resolveRole } from '@TAF/utils/permissions/resolveRole'
import {
  useOrgs,
  useUser,
  useProjects,
  useActiveOrgId,
  useActiveOrgRole,
  useActiveAgentId,
  useProjectAgents,
  useActiveProjectId,
} from '@TAF/state/selectors'

export const useActiveNavData = () => {
  const [user] = useUser()
  const [orgs] = useOrgs()
  const [agents] = useProjectAgents()
  const [projects] = useProjects()
  const [activeOrgId] = useActiveOrgId()
  const [activeOrgRole] = useActiveOrgRole()
  const [activeAgentId] = useActiveAgentId()
  const [activeProjectId] = useActiveProjectId()

  const role = resolveRole(user?.role, activeOrgRole)

  return useMemo<TNavCtx>(
    () => ({
      role,
      orgId: activeOrgId,
      agentId: activeAgentId,
      projectId: activeProjectId,
      agents: agents || undefined,
      org: activeOrgId && orgs?.[activeOrgId],
      project: activeProjectId && projects?.[activeProjectId],
    }),
    [role, orgs, agents, projects, activeOrgId, activeAgentId, activeProjectId]
  )
}
