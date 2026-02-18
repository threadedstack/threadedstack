/**
 * Database Seeds Index
 * Exports all seed data for database initialization
 */
export * from './users.seed'
export * from './orgs.seed'
export * from './roles.seed'
export * from './quotas.seed'
export * from './agents.seed'
export * from './assets.seed'
export * from './apiKeys.seed'
export * from './secrets.seed'
export * from './threads.seed'
export * from './messages.seed'
export * from './projects.seed'
export * from './endpoints.seed'
export * from './providers.seed'
export * from './functions.seed'
export * from './invitations.seed'
export * from './subscriptions.seed'

/**
 * Seed Insertion Order (respects foreign key dependencies)
 *
 * 1. users - Base users (no dependencies)
 * 2. orgs - Organizations (depends on: users via ownerId)
 * 3. roles - Links users to orgs/projects (depends on: orgs, users, projects)
 * 4. subscriptions - User subscriptions (depends on: users)
 * 5. projects - Org projects (depends on: orgs)
 * 6. apiKeys - API keys for orgs/projects (depends on: orgs, projects)
 * 7. providers - AI providers (depends on: orgs)
 * 8. secrets - Encrypted secrets (depends on: orgs, projects, providers)
 * 9. endpoints - API proxy endpoints (depends on: projects)
 * 10. functions - FaaS functions (depends on: projects, endpoints)
 * 11. agents - AI agents + junction tables (depends on: orgs, providers, projects, functions)
 *     - agentProviders junction created by agent service
 *     - agentProjects junction created by agent service
 *     - agentFunctions junction created by agent service
 * 12. threads - Chat threads (depends on: users, providers, agents)
 * 13. messages - Chat messages (depends on: threads)
 * 14. assets - File assets (depends on: orgs, projects, users, threads, messages, providers)
 * 15. quotas - Org resource tracking (depends on: orgs)
 * 16. invitations - Org invitations (depends on: orgs, users)
 */
