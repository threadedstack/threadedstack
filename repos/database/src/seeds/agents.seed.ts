import type { TAgentInsertOpts } from '@TDB/services/agent'

import { Ids, AgentIds, ProjectIds, ProviderIds, FunctionIds } from '@TDB/seeds/ids.seed'

/**
 * Agent seeds with junction table associations
 * The agent service's upsert handles creating agentProjects, agentProviders, and agentFunctions
 */
export const agentsSeeds: TAgentInsertOpts[] = [
  {
    orgId: Ids.org.acme,
    id: AgentIds.codingAgent,
    name: `Coding Agent`,
    description: `A coding AI Agent`,
    systemPrompt: `You are a senior software engineer.`,
    providerIds: [ProviderIds.acmeAnthropic, ProviderIds.acmeOpenai],
    projects: [
      { id: ProjectIds.acmeApi, name: `Acme API Backend` },
      { id: ProjectIds.acmeMobile, name: `Acme Mobile App` },
      { id: ProjectIds.acmeWeb, name: `Acme Web Dashboard` },
    ],
    functionIds: [FunctionIds.acmeUserValidator, FunctionIds.acmeAuth],
  },
  {
    orgId: Ids.org.acme,
    id: AgentIds.chatAgent,
    name: `Chat Agent`,
    description: `Conversational AI`,
    systemPrompt: `Answer the users questions.`,
    providerIds: [ProviderIds.acmeAnthropic],
    projects: [
      { id: ProjectIds.acmeApi, name: `Acme API Backend` },
      { id: ProjectIds.acmeWeb, name: `Acme Web Dashboard` },
    ],
  },
  {
    orgId: Ids.org.acme,
    id: AgentIds.planningAgent,
    name: `Planning Agent`,
    description: `Project planning and task management AI`,
    systemPrompt: `You are an expert project planner and task manager.`,
    providerIds: [ProviderIds.acmeOpenai],
    projects: [
      { id: ProjectIds.acmeApi, name: `Acme API Backend` },
      { id: ProjectIds.acmeMobile, name: `Acme Mobile App` },
      { id: ProjectIds.acmeWeb, name: `Acme Web Dashboard` },
    ],
  },
  {
    orgId: Ids.org.startup,
    id: AgentIds.supportAgent,
    name: `Support Agent`,
    description: `Customer support AI for Tech Startup`,
    systemPrompt: `You are a helpful customer support agent.`,
    providerIds: [ProviderIds.startupAnthropic],
    projects: [
      { id: ProjectIds.startupPlatform, name: `Platform Core` },
      { id: ProjectIds.startupAi, name: `AI Service` },
    ],
    functionIds: [FunctionIds.startupAi],
  },
]
