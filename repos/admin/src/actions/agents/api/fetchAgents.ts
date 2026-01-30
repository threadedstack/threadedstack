import { agentsApi } from '@TAF/services'
import { upsertAgents } from '@TAF/actions/agents/local/upsertAgents'

export const fetchAgents = async (data?: Record<string, any>) => {
  const resp = await agentsApi.list(data)
  if (resp.error) return { error: resp.error }

  upsertAgents(resp.data)

  return resp
}
