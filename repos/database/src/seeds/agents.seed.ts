import { Agent } from '@tdsk/domain'
import { projectsSeeds } from '@TDB/seeds/projects.seed'
import { Ids, ProviderIds, AgentIds } from '@TDB/seeds/ids.seed'

const projects = projectsSeeds.filter((proj) => proj.orgId === Ids.org.acme)

export const agentsSeeds: Agent[] = [
  new Agent({
    projects,
    orgId: Ids.org.acme,
    id: AgentIds.codingAgent,
    description: `A coding AI Agent`,
    providerId: ProviderIds.acmeAnthropic,
    systemPrompt: `You are a senior software engineer.`,
  }),
  new Agent({
    projects,
    orgId: Ids.org.acme,
    id: AgentIds.chatAgent,
    description: `Conversational AI`,
    providerId: ProviderIds.startupAnthropic,
    systemPrompt: `Answer the users questions.`,
  }),
]
