/**
 * Database Seeds Index
 * Exports all seed data for database initialization
 */
export * from './orgs.seed'
export * from './roles.seed'
export * from './subscriptions.seed'
export * from './quotas.seed'
export * from './projects.seed'
export * from './apiKeys.seed'
export * from './providers.seed'
export * from './secrets.seed'
export * from './configs.seed'
export * from './endpoints.seed'
export * from './functions.seed'
export * from './threads.seed'
export * from './messages.seed'
export * from './assets.seed'
export * from './invitations.seed'
//export * from './users.seed'

/**
 * Seed Insertion Order (respects foreign key dependencies)
 *
 * 1. orgs - Base organizations (no dependencies)
 * 2. roles - Links users to orgs (depends on: orgs, users)
 * 3. subscriptions - User subscriptions (depends on: users)
 * 4. quotas - Org resource tracking (depends on: orgs)
 * 5. projects - Org projects (depends on: orgs)
 * 6. apiKeys - API keys for orgs/projects (depends on: orgs, projects)
 * 7. providers - External API providers (depends on: orgs, projects, users)
 * 8. secrets - Encrypted secrets (depends on: orgs, projects, providers)
 * 9. configs - Configuration data (depends on: orgs, projects, users)
 * 10. endpoints - API proxy endpoints (depends on: projects)
 * 11. functions - FaaS functions (depends on: projects, endpoints)
 * 12. threads - Chat threads (depends on: users, providers, configs)
 * 13. messages - Chat messages (depends on: threads)
 * 14. assets - File assets (depends on: orgs, projects, users, threads, messages, providers)
 * 15. invitations - Org invitations (depends on: orgs, users)
 *
 * Note: Users already exist in neon_auth.user table, no seeding required
 */
