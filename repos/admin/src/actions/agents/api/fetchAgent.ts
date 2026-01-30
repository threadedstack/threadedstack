import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export const fetchAgent = async (id: string) => {
  const resp = await agentsApi.get(id)
  if (resp.error) return { error: resp.error }
  resp.data && upsertAgent(resp.data)

  return resp
}
