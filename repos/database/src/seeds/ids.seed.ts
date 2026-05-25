/**
 * Seed ids are defined here to avoid circular endpoints
 * Some of the entities have cross-relationship dependencies
 * Defining them here allows importing them anywhere
 *
 * Entity IDs: 3-char prefix (xx_) + 7-digit zero-padded number (10 chars total)
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
    codingAgent: `ag_0000001`,
    openrouterAgent: `ag_0000002`,
    googleAgent: `ag_0000003`,
    chatAgent: `ag_0000004`,
    generalAgent: `ag_0000005`,
    ollamaAgent: `ag_0000006`,
  },
  apikey: {
    tdskOrgKey: `ak_0000001`,
    acmeOrgKey: `ak_0000002`,
    acmeApiProjectKey: `ak_0000003`,
    startupOrgKey: `ak_0000004`,
    personalKey: `ak_0000005`,
  },
  function: {
    acmeUserValidator: `fn_0000001`,
    acmeAuth: `fn_0000002`,
    startupAi: `fn_0000003`,
    personal: `fn_0000004`,
    agentDataParser: `fn_0000005`,
    agentCodeReview: `fn_0000006`,
    agentDocGen: `fn_0000007`,
  },
  org: {
    tdsk: `og_0000001`,
    acme: `og_0000002`,
    startup: `og_0000003`,
    personal: `og_0000004`,
  },
  provider: {
    acmeOpenai: `pv_0000001`,
    acmeAnthropic: `pv_0000002`,
    startupAnthropic: `pv_0000003`,
    personalOpenai: `pv_0000004`,
    zai: `pv_0000005`,
    openrouter: `pv_0000006`,
    google: `pv_0000007`,
    ollama: `pv_0000008`,
    gitHub: `pv_0000009`,
    gitLab: `pv_0000010`,
    deepseek: `pv_0000011`,
  },
  quota: {
    acme202401: `qt_0000001`,
    acme202402: `qt_0000002`,
    startup202401: `qt_0000003`,
    personal202401: `qt_0000004`,
  },
  subscription: {
    owner: `su_0000001`,
    admin: `su_0000002`,
    member: `su_0000003`,
  },
  thread: {
    adminPlanning: `th_0000001`,
    adminSupport: `th_0000002`,
    memberDev: `th_0000003`,
  },
  user: {
    admin: `00000000-0000-0000-0000-000000000001`,
    member: `00000000-0000-0000-0000-000000000002`,
  },
  asset: {
    acmeLogo: `as_0000001`,
    projectDiagram: `as_0000002`,
    userAvatar: `as_0000003`,
    threadAttachment: `as_0000004`,
    messageImage: `as_0000005`,
    providerConfig: `as_0000006`,
  },
  secret: {
    acmeDbPassword: `sc_0000001`,
    acmeApiKey: `sc_0000002`,
    acmeProjectSecret: `sc_0000003`,
    startupApiKey: `sc_0000004`,
    providerAnthropicKey: `sc_0000005`,
    githubToken: `sc_0000006`,
    zaiKey: `sc_0000007`,
    openrouterKey: `sc_0000008`,
    googleKey: `sc_0000009`,
    ollamaKey: `sc_0000010`,
    deepseekKey: `sc_0000011`,
  },
  project: {
    acmeApi: `pj_0000001`,
    acmeMobile: `pj_0000002`,
    acmeWeb: `pj_0000003`,
    startupPlatform: `pj_0000004`,
    startupAi: `pj_0000005`,
    personal: `pj_0000006`,
  },
  message: {
    thread1Msg1: `ms_0000001`,
    thread1Msg2: `ms_0000002`,
    thread2Msg1: `ms_0000003`,
    thread2Msg2: `ms_0000004`,
    thread3Msg1: `ms_0000005`,
    thread4Msg1: `ms_0000006`,
  },
  endpoint: {
    acmeApiGoogle: `ep_0000001`,
    acmeApiUsers: `ep_0000002`,
    acmeApiValidator: `ep_0000003`,
    personalTest: `ep_0000004`,
    acmeApiWebhooks: `ep_0000005`,
    startupInference: `ep_0000006`,
  },
  role: {
    super: `rl_0000001`,
    ownerAcme: `rl_0000002`,
    adminAcme: `rl_0000003`,
    memberAcme: `rl_0000004`,
    ownerStartup: `rl_0000006`,
    memberStartup: `rl_0000007`,
    ownerPersonal: `rl_0000008`,
    adminApi: `rl_0000009`,
    memberApi: `rl_0000010`,
    memberWeb: `rl_0000011`,
  },
  permissionOverride: {
    memberSandboxCreate: `po_0000001`,
    memberDenyExposePort: `po_0000002`,
  },
  invitation: {
    pending: `iv_0000001`,
    accepted: `iv_0000002`,
    startup: `iv_0000003`,
    expired: `iv_0000004`,
    revoked: `iv_0000005`,
  },
  skill: {
    codeReview: `sk_0000001`,
    docGen: `sk_0000002`,
  },
  schedule: {
    dailyStandup: `sd_0000001`,
    weeklyReport: `sd_0000002`,
  },
  sandbox: {
    claudeCode: `sb_0000001`,
    codex: `sb_0000002`,
    openCode: `sb_0000003`,
    antigravity: `sb_0000004`,
    custom: `sb_0000005`,
    openClaw: `sb_0000006`,
    piCodingAgent: `sb_0000007`,
  },
  domain: {
    orgDomain: `dm_0000001`,
    apiDomain: `dm_0000002`,
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
export const PermissionOverrideIds = Ids.permissionOverride
export const UserIds = Ids.user

export const SeedPassword = `TdskSeed123!`
