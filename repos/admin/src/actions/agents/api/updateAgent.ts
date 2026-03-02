import type { TAgentPayload } from '@TAF/types/agent.types'

import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TUpdateAgentOpts = {
  orgId: string
  id: string
  projectId?: string
  data: TAgentPayload
}

export const updateAgent = async (opts: TUpdateAgentOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await agentsApi.update(orgId, id, data, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertAgent(contextKey, resp.data)

  return resp
}
