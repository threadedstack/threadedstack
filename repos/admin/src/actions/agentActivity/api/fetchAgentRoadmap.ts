import { agentActivityApi } from '@TAF/services/agentActivityApi'
import { setAgentPlans } from '@TAF/actions/agentActivity/local/setAgentActivity'

type TFetchAgentRoadmapOpts = {
  orgId: string
  agentId: string
  projectId: string
}

/**
 * Fetch the agent's roadmap (the project's `plans` collection) and write it into
 * its atom.
 *
 * Kept OUT of `fetchAgentActivity` on purpose: the roadmap changes on the order
 * of hours, so the loader fetches it once rather than dragging it through the 5s
 * activity poll. A failure is swallowed (returned, not thrown) so a missing
 * roadmap never blanks the live activity feed.
 */
export const fetchAgentRoadmap = async (opts: TFetchAgentRoadmapOpts) => {
  const { orgId, projectId, agentId } = opts

  const plans = await agentActivityApi.plans(orgId, projectId)
  if (!plans.error) setAgentPlans(agentId, plans.data ?? [])

  return { error: plans.error }
}
