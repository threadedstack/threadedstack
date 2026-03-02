import type { TProviderStepData, TAgentStepData } from '@TAF/types'

import { quickstartApi } from '@TAF/services/quickstartApi'

export type TCreateQuickstart = {
  orgId: string
  agent: TAgentStepData
  provider: TProviderStepData
}

export const createQuickstart = async (opts: TCreateQuickstart) => {
  const { orgId, agent, provider } = opts

  const resp = await quickstartApi.create(orgId, {
    apiKey: provider.apiKey,
    agentName: agent.agentName,
    projectName: agent.projectName,
    model: provider.model || undefined,
    providerBrand: provider.providerBrand,
    systemPrompt: agent.systemPrompt || undefined,
    providerUrl: provider.providerUrl || undefined,
    providerName: provider.providerName || undefined,
    agentDescription: agent.agentDescription || undefined,
  })

  return resp
}
