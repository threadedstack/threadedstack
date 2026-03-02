import type { TAgentPayload } from '@TAF/types/agent.types'

import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TCreateAgentOpts = {
  orgId: string
  projectId?: string
  data: TAgentPayload
}

export const createAgent = async (opts: TCreateAgentOpts) => {
  const { orgId, data, projectId } = opts
  const resp = await agentsApi.create(orgId, data, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || `org`
  resp.data && upsertAgent(contextKey, resp.data)

  return resp
}
