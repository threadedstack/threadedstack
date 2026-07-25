import { agentActivityApi } from '@TAF/services/agentActivityApi'
import {
  setAgentTurns,
  setAgentStatus,
  setAgentMemories,
  setAgentMessages,
} from '@TAF/actions/agentActivity/local/setAgentActivity'

type TFetchAgentActivityOpts = {
  orgId: string
  agentId: string
  projectId: string
}

/**
 * Fetch all four telemetry reads for one agent and write them into their atoms.
 *
 * The four reads are INDEPENDENT: one failing (say memories) must not blank the
 * other three, so each result is applied on its own and failures are collected
 * rather than thrown. That matches the spec's partial-failure requirement — the
 * page shows an error for the failed section while the rest still renders.
 */
export const fetchAgentActivity = async (opts: TFetchAgentActivityOpts) => {
  const { orgId, projectId, agentId } = opts

  const [status, turns, messages, memories] = await Promise.all([
    agentActivityApi.status(orgId, projectId, agentId),
    agentActivityApi.turns(orgId, projectId, agentId),
    agentActivityApi.messages(orgId, projectId, agentId),
    agentActivityApi.memories(orgId, projectId, agentId),
  ])

  if (!status.error) setAgentStatus(agentId, status.data ?? null)
  if (!turns.error) setAgentTurns(agentId, turns.data ?? [])
  if (!messages.error) setAgentMessages(agentId, messages.data ?? [])
  if (!memories.error) setAgentMemories(agentId, memories.data ?? [])

  const errors = [status, turns, messages, memories]
    .map((resp) => resp.error)
    .filter(Boolean)

  return { errors }
}
