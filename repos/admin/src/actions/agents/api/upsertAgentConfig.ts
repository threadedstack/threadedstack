import type { TAgentProjectConfig } from '@tdsk/domain'

import { agentsApi } from '@TAF/services'

export type TUpsertAgentConfigOpts = {
  orgId: string
  agentId: string
  projectId: string
  data: Partial<TAgentProjectConfig>
}

export const upsertAgentConfig = async (opts: TUpsertAgentConfigOpts) => {
  const { orgId, projectId, agentId, data } = opts
  return agentsApi.upsertConfig(orgId, projectId, agentId, data)
}
