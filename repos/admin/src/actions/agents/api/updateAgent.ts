import type { Agent } from '@tdsk/domain'

import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TUpdateAgentOpts = {
  orgId: string
  id: string
  data: Partial<Agent>
  projectId?: string
}

export const updateAgent = async (opts: TUpdateAgentOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await agentsApi.update(orgId, id, data, projectId)
  if (resp.error) return { error: resp.error }
  resp.data && upsertAgent(resp.data)

  return resp
}
