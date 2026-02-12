import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import { useAgents, useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { setActiveAgentId } from '@TAF/state/accessors'

export const useAgentsSidebarSync = () => {
  const [agents] = useAgents()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const location = useLocation()

  // Fetch agents when project becomes active so sidebar can render them
  useEffect(() => {
    if (orgId && projectId) fetchAgents({ orgId, projectId })
  }, [orgId, projectId])

  // Sync activeAgentId from URL on SPA navigation
  useEffect(() => {
    const agentId = getParamValue((part, before) =>
      Boolean(before === `agents` && part && part !== `chat` && part !== `threads`)
    )
    if (agentId) setActiveAgentId(agentId)
  }, [location.pathname])
}
