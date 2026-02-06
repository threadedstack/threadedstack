import type { TDBAgentInsert } from '@TDB/types'

import { Agent } from '@tdsk/domain'
import { ProjectIds } from '@TDB/seeds/projects.seed'
import { ProviderIds } from '@TDB/seeds/providers.seed'

export const AgentIds = {
  codingAgent: `aaa00000-0000-0000-0000-000000000003`,
  planningAgent: `aaa00000-0000-0000-0000-000000000001`,
  supportAgent: `aaa00000-0000-0000-0000-000000000002`,
  chatAgent: `aaa00000-0000-0000-0000-000000000004`,
} as const

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
