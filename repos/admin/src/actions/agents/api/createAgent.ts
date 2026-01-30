import type { Agent } from '@tdsk/domain'

import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export const createAgent = async (data: Partial<Agent>) => {
  const resp = await agentsApi.create(data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertAgent(resp.data)

  return resp
}
