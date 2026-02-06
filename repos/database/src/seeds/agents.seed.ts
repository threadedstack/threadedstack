import type { TDBAgentInsert } from '@TDB/types'

import { Agent } from '@tdsk/domain'
import { ProviderIds, ProjectIds, AgentIds } from '@TDB/seeds/ids.seed'

export const agentsSeeds: TDBAgentInsert[] = [
  new Agent({
    id: AgentIds.codingAgent,
    projectId: ProjectIds.acmeApi,
    description: `A coding AI Agent`,
    providerId: ProviderIds.acmeAnthropic,
    systemPrompt: `You are a senior software engineer.`,
  }),
  new Agent({
    id: AgentIds.chatAgent,
    projectId: ProjectIds.startupAi,
    description: `Conversational AI`,
    providerId: ProviderIds.startupAnthropic,
    systemPrompt: `Answer the users questions.`,
  }),
]
