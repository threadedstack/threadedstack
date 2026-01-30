import { agentsApi } from '@TAF/services'
import { removeAgent } from '@TAF/actions/agents/local/removeAgent'

export const deleteAgent = async (id: string) => {
  const resp = await agentsApi.delete(id)

  if (resp.error) return { error: resp.error }
  resp.data?.success && removeAgent(id)

  return resp
}
