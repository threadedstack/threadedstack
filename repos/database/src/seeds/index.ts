/**
 * Database Seeds Index
 * Exports all seed data for database initialization
 */
export * from './users.seed'
export * from './orgs.seed'
export * from './roles.seed'
export * from './subscriptions.seed'
export * from './quotas.seed'
export * from './projects.seed'
export * from './apiKeys.seed'
export * from './providers.seed'
export * from './secrets.seed'
export * from './endpoints.seed'
export * from './functions.seed'
export * from './threads.seed'
export * from './messages.seed'
export * from './assets.seed'
export * from './invitations.seed'

/**
 * Seed Insertion Order (respects foreign key dependencies)
 *
 * 1. users - Base users (no dependencies)
 * 2. orgs - Base organizations (no dependencies)
 * 3. roles - Links users to orgs (depends on: orgs, users)
 * 4. subscriptions - User subscriptions (depends on: users)
 * 5. quotas - Org resource tracking (depends on: orgs)
 * 6. projects - Org projects (depends on: orgs)
 * 7. apiKeys - API keys for orgs/projects (depends on: orgs, projects)
 * 8. providers - External API providers (depends on: orgs, projects, users)
 * 9. secrets - Encrypted secrets (depends on: orgs, projects, providers)
 * 10. endpoints - API proxy endpoints (depends on: projects)
 * 11. functions - FaaS functions (depends on: projects, endpoints)
 * 12. threads - Chat threads (depends on: users, providers)
 * 14. messages - Chat messages (depends on: threads)
 * 15. assets - File assets (depends on: orgs, projects, users, threads, messages, providers)
 * 16. invitations - Org invitations (depends on: orgs, users)
 */
