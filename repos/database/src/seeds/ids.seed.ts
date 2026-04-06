/**
 * Seed ids are defined here to avoid circular endpoints
 * Some of the entities have cross-relationship dependencies
 * Defining them here allows importing them anywhere
 *
 * Entity IDs: 2-char entity prefix + 8-digit zero-padded number (10 chars total)
 * Matches nanoid(10) column format: ^[A-Za-z0-9_-]{10}$
 *
 * User IDs: Must remain UUID format because neon_auth.user.id is a uuid column
 * managed by Neon Auth (not Drizzle). All userId FK references are also uuid.
 */

export const Ids = {
  super: {
    user: `00000000-0000-0000-0000-000000000000`,
  },
  agent: {
    codingAgent: `ag00000001`,
    planningAgent: `ag00000002`,
    supportAgent: `ag00000003`,
    chatAgent: `ag00000004`,
    generalAgent: `ag00000005`,
  },
  apikey: {
    tdskOrgKey: `ak00000001`,
    acmeOrgKey: `ak00000002`,
    acmeApiProjectKey: `ak00000003`,
    startupOrgKey: `ak00000004`,
    personalKey: `ak00000005`,
  },
  function: {
    acmeUserValidator: `fn00000001`,
    acmeAuth: `fn00000002`,
    startupAi: `fn00000003`,
    personal: `fn00000004`,
    agentDataParser: `fn00000005`,
    agentCodeReview: `fn00000006`,
    agentDocGen: `fn00000007`,
  },
  org: {
    tdsk: `og00000001`,
    acme: `og00000002`,
    startup: `og00000003`,
    personal: `og00000004`,
  },
  provider: {
    acmeOpenai: `pv00000001`,
    acmeAnthropic: `pv00000002`,
    startupAnthropic: `pv00000003`,
    personalOpenai: `pv00000004`,
    zai: `pv00000005`,
  },
  quota: {
    acme202401: `qt00000001`,
    acme202402: `qt00000002`,
    startup202401: `qt00000003`,
    personal202401: `qt00000004`,
  },
  subscription: {
    owner: `sb00000001`,
    admin: `sb00000002`,
    member: `sb00000003`,
    viewer: `sb00000004`,
  },
  thread: {
    adminPlanning: `th00000001`,
    adminSupport: `th00000002`,
    memberDev: `th00000003`,
    viewer: `th00000004`,
  },
  user: {
    admin: `00000000-0000-0000-0000-000000000001`,
    member: `00000000-0000-0000-0000-000000000002`,
    viewer: `00000000-0000-0000-0000-000000000003`,
  },
  asset: {
    acmeLogo: `as00000001`,
    projectDiagram: `as00000002`,
    userAvatar: `as00000003`,
    threadAttachment: `as00000004`,
    messageImage: `as00000005`,
    providerConfig: `as00000006`,
  },
  secret: {
    acmeDbPassword: `sc00000001`,
    acmeApiKey: `sc00000002`,
    acmeProjectSecret: `sc00000003`,
    startupApiKey: `sc00000004`,
    providerAnthropicKey: `sc00000005`,
    githubToken: `sc00000006`,
    zaiKey: `sc00000007`,
  },
  project: {
    acmeApi: `pj00000001`,
    acmeMobile: `pj00000002`,
    acmeWeb: `pj00000003`,
    startupPlatform: `pj00000004`,
    startupAi: `pj00000005`,
    personal: `pj00000006`,
  },
  message: {
    thread1Msg1: `ms00000001`,
    thread1Msg2: `ms00000002`,
    thread2Msg1: `ms00000003`,
    thread2Msg2: `ms00000004`,
    thread3Msg1: `ms00000005`,
    thread4Msg1: `ms00000006`,
  },
  endpoint: {
    acmeApiGoogle: `ep00000001`,
    acmeApiUsers: `ep00000002`,
    acmeApiValidator: `ep00000003`,
    personalTest: `ep00000004`,
    acmeApiWebhooks: `ep00000005`,
    startupInference: `ep00000006`,
  },
  role: {
    super: `rl00000001`,
    ownerAcme: `rl00000002`,
    adminAcme: `rl00000003`,
    memberAcme: `rl00000004`,
    viewerAcme: `rl00000005`,
    ownerStartup: `rl00000006`,
    memberStartup: `rl00000007`,
    ownerPersonal: `rl00000008`,
    adminApi: `rl00000009`,
    memberApi: `rl00000010`,
    memberWeb: `rl00000011`,
    viewerWeb: `rl00000012`,
  },
  invitation: {
    pending: `iv00000001`,
    accepted: `iv00000002`,
    startup: `iv00000003`,
    expired: `iv00000004`,
    revoked: `iv00000005`,
  },
  skill: {
    codeReview: `sk00000001`,
    docGen: `sk00000002`,
  },
  schedule: {
    dailyStandup: `sd00000001`,
    weeklyReport: `sd00000002`,
  },
  sandbox: {
    devNode: `sb_0000001`,
  },
  domain: {
    orgDomain: `dm00000001`,
    apiDomain: `dm00000002`,
  },
}

export const AgentIds = Ids.agent
export const AssetIds = Ids.asset
export const ApiKeyIds = Ids.apikey
export const DomainIds = Ids.domain
export const EndpointIds = Ids.endpoint
export const FunctionIds = Ids.function
export const InvitationIds = Ids.invitation
export const MessageIds = Ids.message
export const OrgIds = Ids.org
export const ProviderIds = Ids.provider
export const ProjectIds = Ids.project
export const QuotaIds = Ids.quota
export const RoleIds = Ids.role
export const SecretIds = Ids.secret
export const SubscriptionIds = Ids.subscription
export const ThreadIds = Ids.thread
export const SkillIds = Ids.skill
export const ScheduleIds = Ids.schedule
export const SandboxIds = Ids.sandbox
export const UserIds = Ids.user
