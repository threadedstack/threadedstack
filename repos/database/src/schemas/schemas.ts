/**
 * IMPORTANT - Do not import '@TDB/schemas/users' OR '@TDB/schemas/certificates'
 * These schemas are not managed by drizzle so should not be included in migrations
 * The Users table managed by neon and the certificates table by caddy.
 * The schemas exists so they can be read, but they should not be included in other database operations.
 */

export { orgs, orgsRelations } from '@TDB/schemas/orgs'
export { roles, rolesRelations } from '@TDB/schemas/roles'
export { quotas, quotasRelations } from '@TDB/schemas/quotas'
export { agents, agentsRelations } from '@TDB/schemas/agents'
export { assets, assetsRelations } from '@TDB/schemas/assets'
export { skills, skillsRelations } from '@TDB/schemas/skills'
export { threads, threadsRelations } from '@TDB/schemas/threads'
export { domains, domainsRelations } from '@TDB/schemas/domains'
export { secrets, secretsRelations } from '@TDB/schemas/secrets'
export { apiKeys, apiKeysRelations } from '@TDB/schemas/apiKeys'
export { invoices, invoicesRelations } from '@TDB/schemas/invoices'
export { messages, messagesRelations } from '@TDB/schemas/messages'
export { projects, projectsRelations } from '@TDB/schemas/projects'
export { schedules, schedulesRelations } from '@TDB/schemas/schedules'
export { sandboxes, sandboxesRelations } from '@TDB/schemas/sandboxes'
export { functions, functionsRelations } from '@TDB/schemas/functions'
export { providers, providersRelations } from '@TDB/schemas/providers'
export { endpoints, endpointsRelations } from '@TDB/schemas/endpoints'
export { invitations, invitationsRelations } from '@TDB/schemas/invitations'
export { agentSkills, agentSkillsRelations } from '@TDB/schemas/agentSkills'
export { scheduleRuns, scheduleRunsRelations } from '@TDB/schemas/scheduleRuns'
export { agentProjects, agentProjectsRelations } from '@TDB/schemas/agentProjects'
export { subscriptions, subscriptionsRelations } from '@TDB/schemas/subscriptions'
export { agentProviders, agentProvidersRelations } from '@TDB/schemas/agentProviders'
export { sandboxSessions, sandboxSessionsRelations } from '@TDB/schemas/sandboxSessions'
export { sandboxProjects, sandboxProjectsRelations } from '@TDB/schemas/sandboxProjects'
export {
  permissionOverrides,
  permissionOverridesRelations,
} from '@TDB/schemas/permissionOverrides'
export {
  sandboxSkills,
  sandboxSkillsRelations,
} from '@TDB/schemas/sandboxSkills'
export {
  sandboxProviders,
  sandboxProvidersRelations,
} from '@TDB/schemas/sandboxProviders'
export {
  projectProviders,
  projectProvidersRelations,
} from '@TDB/schemas/projectProviders'
export {
  sandboxProjectProviders,
  sandboxProjectProvidersRelations,
} from '@TDB/schemas/sandboxProjectProviders'
