import type { TNavCtx } from '@TAF/types'
import { useMemo } from 'react'
import {
  useOrgs,
  useProjectAgents,
  useProjects,
  useActiveOrgId,
  useActiveAgentId,
  useActiveProjectId,
} from '@TAF/state/selectors'

export const useActiveNavData = () => {
  const [orgs] = useOrgs()
  const [agents] = useProjectAgents()
  const [projects] = useProjects()
  const [activeOrgId] = useActiveOrgId()
  const [activeAgentId] = useActiveAgentId()
  const [activeProjectId] = useActiveProjectId()

  return useMemo<TNavCtx>(
    () => ({
      orgId: activeOrgId,
      agentId: activeAgentId,
      projectId: activeProjectId,
      org: activeOrgId && orgs?.[activeOrgId],
      project: activeProjectId && projects?.[activeProjectId],
      agents: agents || undefined,
    }),
    [orgs, agents, projects, activeOrgId, activeAgentId, activeProjectId]
  )
}
