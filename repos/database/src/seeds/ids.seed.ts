/**
 * Seed ids are defined here to avoid circular endpoints
 * Some of the entities have cross-relationship dependencies
 * Defining them here allows importing them anywhere
 */

export const AgentIds = {
  codingAgent: `aaa00000-0000-0000-0000-000000000003`,
  planningAgent: `aaa00000-0000-0000-0000-000000000001`,
  supportAgent: `aaa00000-0000-0000-0000-000000000002`,
  chatAgent: `aaa00000-0000-0000-0000-000000000004`,
} as const

/**
 * Assets Seed Data
 * Exclusive Arc: orgId OR projectId OR userId OR threadId OR messageId (exactly one)
 */
export const AssetIds = {
  acmeLogo: `e0000000-0000-0000-0000-000000000001`,
  projectDiagram: `e0000000-0000-0000-0000-000000000002`,
  userAvatar: `e0000000-0000-0000-0000-000000000003`,
  threadAttachment: `e0000000-0000-0000-0000-000000000004`,
  messageImage: `e0000000-0000-0000-0000-000000000005`,
  providerConfig: `e0000000-0000-0000-0000-000000000006`,
} as const

/**
 * API Keys Seed Data
 * Note: keyHash should be a hashed value in production
 */
export const ApiKeyIds = {
  acmeOrgKey: `60000000-0000-0000-0000-000000000001`,
  acmeApiProjectKey: `60000000-0000-0000-0000-000000000002`,
  startupOrgKey: `60000000-0000-0000-0000-000000000003`,
  personalKey: `60000000-0000-0000-0000-000000000004`,
} as const

/**
 * Configs Seed Data
 * Exclusive Arc: userId OR orgId OR projectId (exactly one)
 */
export const ConfigIds = {
  user: `90000000-0000-0000-0000-000000000001`,
  acmeOrg: `90000000-0000-0000-0000-000000000002`,
  acmeApi: `90000000-0000-0000-0000-000000000003`,
  startup: `90000000-0000-0000-0000-000000000004`,
  personal: `90000000-0000-0000-0000-000000000005`,
} as const

/**
 * Endpoints Seed Data
 */
export const EndpointIds = {
  acmeApiGoogle: `a0000000-0000-0000-0000-000000000001`,
  acmeApiUsers: `a0000000-0000-0000-0000-000000000002`,
  acmeApiValidator: `a0000000-0000-0000-0000-000000000005`,
  personalTest: `a0000000-0000-0000-0000-000000000005`,
  acmeApiWebhooks: `a0000000-0000-0000-0000-000000000003`,
  startupInference: `a0000000-0000-0000-0000-000000000004`,
} as const

/**
 * Functions Seed Data
 */
export const FunctionIds = {
  acmeUserValidator: `b0000000-0000-0000-0000-000000000001`,
  acmeAuth: `b0000000-0000-0000-0000-000000000002`,
  startupAi: `b0000000-0000-0000-0000-000000000003`,
  personal: `b0000000-0000-0000-0000-000000000004`,
} as const

/**
 * Invitations Seed Data
 * Organization invitation management
 */
export const InvitationIds = {
  pending: `f0000000-0000-0000-0000-000000000001`,
  accepted: `f0000000-0000-0000-0000-000000000002`,
  startup: `f0000000-0000-0000-0000-000000000003`,
  expired: `f0000000-0000-0000-0000-000000000004`,
  revoked: `f0000000-0000-0000-0000-000000000005`,
} as const

/**
 * Messages Seed Data
 * Chat messages within threads
 */
export const MessageIds = {
  thread1Msg1: `d0000000-0000-0000-0000-000000000001`,
  thread1Msg2: `d0000000-0000-0000-0000-000000000002`,
  thread2Msg1: `d0000000-0000-0000-0000-000000000003`,
  thread2Msg2: `d0000000-0000-0000-0000-000000000004`,
  thread3Msg1: `d0000000-0000-0000-0000-000000000005`,
  thread4Msg1: `d0000000-0000-0000-0000-000000000006`,
} as const

/**
 * Organizations Seed Data
 */
export const OrgIds = {
  tdsk: `10000000-0000-0000-0000-000000000000`,
  acme: `10000000-0000-0000-0000-000000000001`,
  startup: `10000000-0000-0000-0000-000000000002`,
  personal: `10000000-0000-0000-0000-000000000003`,
} as const

/**
 * Providers Seed Data
 * External API provider configurations
 */
export const ProviderIds = {
  acmeOpenai: `70000000-0000-0000-0000-000000000001`,
  acmeAnthropic: `70000000-0000-0000-0000-000000000002`,
  startupAnthropic: `70000000-0000-0000-0000-000000000003`,
  personalOpenai: `70000000-0000-0000-0000-000000000004`,
} as const

/**
 * Projects Seed Data
 */
export const ProjectIds = {
  acmeApi: `50000000-0000-0000-0000-000000000001`,
  acmeMobile: `50000000-0000-0000-0000-000000000002`,
  acmeWeb: `50000000-0000-0000-0000-000000000003`,
  startupPlatform: `50000000-0000-0000-0000-000000000004`,
  startupAi: `50000000-0000-0000-0000-000000000005`,
  personal: `50000000-0000-0000-0000-000000000006`,
} as const

/**
 * Quotas Seed Data
 * Tracks resource usage per org per period
 */
export const QuotaIds = {
  acme202401: `40000000-0000-0000-0000-000000000001`,
  acme202402: `40000000-0000-0000-0000-000000000002`,
  startup202401: `40000000-0000-0000-0000-000000000003`,
  personal202401: `40000000-0000-0000-0000-000000000004`,
} as const

/**
 * Roles Seed Data
 * RBAC accesses to specific entities
 */
export const RoleIds = {
  ownerAcme: `20000000-0000-0000-0000-000000000001`,
  adminAcme: `20000000-0000-0000-0000-000000000002`,
  memberAcme: `20000000-0000-0000-0000-000000000003`,
  viewerAcme: `20000000-0000-0000-0000-000000000004`,
  ownerStartup: `20000000-0000-0000-0000-000000000005`,
  memberStartup: `20000000-0000-0000-0000-000000000006`,
  ownerPersonal: `20000000-0000-0000-0000-000000000007`,
} as const

/**
 * Secrets Seed Data
 * Exclusive Arc: orgId OR projectId OR providerId (exactly one)
 * Note: encryptedValue should be actual encrypted data in production
 */
export const SecretIds = {
  acmeDbPassword: `80000000-0000-0000-0000-000000000001`,
  acmeApiKey: `80000000-0000-0000-0000-000000000002`,
  acmeProjectSecret: `80000000-0000-0000-0000-000000000003`,
  startupApiKey: `80000000-0000-0000-0000-000000000004`,
  providerAnthropicKey: `80000000-0000-0000-0000-000000000005`,
  personalToken: `80000000-0000-0000-0000-000000000006`,
} as const

/**
 * Subscriptions Seed Data
 * Each user can have only ONE subscription (unique userId constraint)
 */
export const SubscriptionIds = {
  owner: `30000000-0000-0000-0000-000000000001`,
  admin: `30000000-0000-0000-0000-000000000002`,
  member: `30000000-0000-0000-0000-000000000003`,
  viewer: `30000000-0000-0000-0000-000000000004`,
} as const

/**
 * Threads Seed Data
 * Chat conversation threads
 */
export const ThreadIds = {
  memberDev: `c0000000-0000-0000-0000-000000000003`,
  adminPlanning: `c0000000-0000-0000-0000-000000000001`,
  adminSupport: `c0000000-0000-0000-0000-000000000002`,
  viewer: `c0000000-0000-0000-0000-000000000004`,
} as const

/**
 * User Seed Data
 */
export const UserIds = {
  owner: `00000000-0000-0000-0000-000000000000`,
  admin: `00000000-0000-0000-0000-000000000001`,
  member: `00000000-0000-0000-0000-000000000002`,
  viewer: `00000000-0000-0000-0000-000000000003`,
} as const
