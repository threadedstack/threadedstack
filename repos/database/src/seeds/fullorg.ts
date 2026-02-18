import { Ids } from '@TDB/seeds/ids.seed'
import { encryptSecret } from '@TDB/utils/crypto'
import {
  User,
  Role,
  Agent,
  Quota,
  Asset,
  ApiKey,
  Thread,
  Domain,
  Secret,
  Message,
  Project,
  Provider,
  EProvider,
  Invitation,
  Subscription,
  Organization,
  EFunLanguage,
  FaaSEndpoint,
  EEndpointType,
  ProxyEndpoint,
  EInviteStatus,
  Function as FunctionModel,
} from '@tdsk/domain'

const org = new Organization({
  id: Ids.org.tdsk,
  name: `Threaded Stack`,
  description: `Developer platform that offers AI Agent management, functions as a service and API request proxying including secure dynamic secret injection`,
})

const users = {
  owner: new User({
    id: Ids.super.user,
    name: `Lance Tipton`,
    banExpires: undefined,
    email: `lancetipton04@gmail.com`,
  }),
  admin: new User({
    id: Ids.user.admin,
    name: `Test Admin`,
    email: `test.admin@threadedstack.com`,
  }),
  member: new User({
    id: Ids.user.member,
    name: `Test Member`,
    email: `test.member@threadedstack.com`,
  }),
  viewer: new User({
    id: Ids.user.viewer,
    name: `Test Viewer`,
    email: `test.viewer@threadedstack.com`,
  }),
}

const roles = {
  super: new Role({
    type: `super`,
    orgId: org.id,
    projectId: undefined,
    id: `20000000-0000-0000-0000-000000000000`,
    userId: users.owner.id,
    name: `Organization Super`,
  }),
  owner: new Role({
    type: `owner`,
    orgId: org.id,
    projectId: undefined,
    id: Ids.role.ownerAcme,
    userId: users.owner.id,
    name: `Organization Owner`,
  }),
  admin: new Role({
    type: `admin`,
    orgId: org.id,
    projectId: undefined,
    id: Ids.role.adminAcme,
    userId: users.admin.id,
    name: `Administrator`,
  }),
  member: new Role({
    type: `member`,
    orgId: org.id,
    name: `Member`,
    projectId: undefined,
    id: Ids.role.memberAcme,
    userId: users.member.id,
  }),
  viewer: new Role({
    type: `viewer`,
    orgId: org.id,
    name: `Viewer`,
    projectId: undefined,
    id: Ids.role.viewerAcme,
    userId: users.viewer.id,
  }),
}

const projects = {
  api: new Project({
    orgId: org.id,
    id: Ids.project.acmeApi,
    name: `API Backend`,
    gitUrl: `https://github.com/acme-corp/api-backend`,
    branch: `master`,
    meta: {
      version: `2.5.0`,
      framework: `express`,
      language: `typescript`,
      description: `Core REST API backend service`,
    },
  }),
  mobile: new Project({
    orgId: org.id,
    id: Ids.project.acmeMobile,
    name: `Mobile App`,
    gitUrl: `https://github.com/acme-corp/mobile-app`,
    branch: `develop`,
    meta: {
      version: `1.8.2`,
      language: `typescript`,
      framework: `react-native`,
      description: `iOS and Android mobile application`,
    },
  }),
  web: new Project({
    orgId: org.id,
    id: Ids.project.acmeWeb,
    name: `Web Dashboard`,
    gitUrl: `https://github.com/acme-corp/web-dashboard`,
    branch: `main`,
    meta: {
      version: `3.2.1`,
      framework: `react`,
      language: `typescript`,
      description: `Admin web dashboard`,
    },
  }),
}

const subscriptions = {
  sub: new Subscription({
    tier: `free`,
    status: `active`,
    polarId: undefined,
    userId: Ids.super.user,
    polarPriceId: undefined,
    cancelAtPeriodEnd: false,
    id: Ids.subscription.owner,
    polarCustomerId: undefined,
    currentPeriodEnd: undefined,
    currentPeriodStart: new Date(`2024-01-01`).toISOString(),
  }),
}

const apiKeys = {
  orgMaster: new ApiKey({
    active: true,
    rateLimit: 1000,
    orgId: org.id,
    projectId: undefined,
    keyPrefix: `tdsk_master`,
    scopes: `read,write,admin`,
    name: `Threaded Stack Org Master Key`,
    id: Ids.apikey.tdskOrgKey,
    expiresAt: new Date(`2025-12-31`),
    lastUsedAt: new Date(`2024-01-25`),
    keyHash: `hashed_tdsk_org_master_key_12345`,
  }),
  apiProject: new ApiKey({
    active: true,
    rateLimit: 500,
    orgId: undefined,
    projectId: projects.api.id,
    scopes: `read,write`,
    keyPrefix: `tdsk_api_proj`,
    name: `API Backend Project Key`,
    id: Ids.apikey.acmeApiProjectKey,
    expiresAt: new Date(`2024-12-31`),
    lastUsedAt: new Date(`2024-01-26`),
    keyHash: `hashed_tdsk_api_project_key_67890`,
  }),
}

const providers = {
  openai: new Provider({
    orgId: org.id,
    type: EProvider.ai,
    id: Ids.provider.acmeOpenai,
    name: `OpenAI Provider`,
    options: {
      maxTokens: 4096,
      temperature: 0.7,
      model: `gpt-4-turbo`,
    },
  }),
  anthropic: new Provider({
    orgId: org.id,
    type: EProvider.ai,
    id: Ids.provider.acmeAnthropic,
    name: `Anthropic Provider`,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
}

// Generate encrypted secrets
const anthropicSecret = await encryptSecret(
  `Anthropic API Key`,
  `sk-ant-test-key-for-seeding`,
  Ids.project.acmeApi
)

const databaseSecret = await encryptSecret(
  `Database Password`,
  `SuperSecureDbPassword123!`,
  Ids.project.acmeApi
)

const githubSecret = await encryptSecret(
  `GitHub Token`,
  `ghp_test_github_token_for_seeding`,
  org.id
)

const secrets = {
  anthropic: new Secret({
    orgId: undefined,
    providerId: undefined,
    name: `Anthropic API Key`,
    hashKey: anthropicSecret.hashKey,
    projectId: Ids.project.acmeApi,
    id: Ids.secret.providerAnthropicKey,
    description: `Anthropic API authentication key`,
    encryptedValue: anthropicSecret.encryptedValue,
  }),
  database: new Secret({
    orgId: undefined,
    providerId: undefined,
    name: `Database Password`,
    hashKey: databaseSecret.hashKey,
    id: Ids.secret.acmeDbPassword,
    projectId: Ids.project.acmeApi,
    description: `Production database password`,
    encryptedValue: databaseSecret.encryptedValue,
  }),
  github: new Secret({
    name: `GitHub Token`,
    projectId: undefined,
    providerId: undefined,
    orgId: org.id,
    id: Ids.secret.githubToken,
    hashKey: githubSecret.hashKey,
    description: `GitHub PAT`,
    encryptedValue: githubSecret.encryptedValue,
  }),
}

const agents = {
  coding: new Agent({
    orgId: org.id,
    id: Ids.agent.codingAgent,
    description: `A coding AI Agent`,
    projects: Object.values(projects),
    providerId: Ids.provider.acmeAnthropic,
    systemPrompt: `You are a senior software engineer.`,
    secrets: [secrets.anthropic],
  }),
  chat: new Agent({
    orgId: org.id,
    id: Ids.agent.chatAgent,
    description: `Conversational AI`,
    projects: Object.values(projects),
    providerId: Ids.provider.acmeAnthropic,
    systemPrompt: `Answer the users questions.`,
    secrets: [secrets.anthropic],
  }),
}

const endpoints = {
  googleProxy: new ProxyEndpoint({
    type: EEndpointType.proxy,
    id: Ids.endpoint.acmeApiGoogle,
    projectId: projects.api.id,
    path: `/google`,
    name: `Google Proxy`,
    method: `GET`,
    public: false,
    headers: {
      [`Content-Type`]: `application/json`,
      [`X-API-Version`]: `v1`,
    },
    options: {
      retries: 3,
      timeout: 30000,
      type: EEndpointType.proxy,
      url: `https://google.com`,
    },
  }),
  usersApi: new ProxyEndpoint({
    type: EEndpointType.proxy,
    id: Ids.endpoint.acmeApiUsers,
    projectId: projects.api.id,
    name: `Users API`,
    path: `/api/v1/users`,
    method: `GET`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 1,
      timeout: 10000,
      type: EEndpointType.proxy,
      url: `https://fake-json-api.mock.beeceptor.com/users`,
    },
  }),
  webhooks: new FaaSEndpoint({
    name: `Webhook Receiver`,
    path: `/api/v1/webhooks`,
    type: EEndpointType.faas,
    projectId: projects.api.id,
    id: Ids.endpoint.acmeApiWebhooks,
    method: `POST`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 0,
      timeout: 5000,
      type: EEndpointType.faas,
      functionId: Ids.function.acmeAuth,
    },
  }),
}

const functions = {
  userValidator: new FunctionModel({
    id: Ids.function.acmeUserValidator,
    projectId: projects.api.id,
    endpointId: endpoints.usersApi.id,
    name: `User Data Validator`,
    description: `Validates user input before saving`,
    language: EFunLanguage.typescript,
    branch: `main`,
    content: `export async function validate(user: any) {
  if (!user.email || !user.email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (!user.name || user.name.length < 2) {
    throw new Error('Name too short');
  }
  return { valid: true };
}`,
    defaultArgs: [`{}`],
    dependencies: {
      zod: `^3.22.0`,
    },
  }),
  authToken: new FunctionModel({
    id: Ids.function.acmeAuth,
    projectId: projects.api.id,
    endpointId: endpoints.webhooks.id,
    name: `Auth Token Generator`,
    description: `Generates JWT tokens for authenticated users`,
    language: EFunLanguage.typescript,
    branch: `main`,
    content: `import jwt from 'jsonwebtoken';

export async function generateToken(userId: string) {
  const payload = { userId, timestamp: Date.now() };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}`,
    defaultArgs: [`user-123`],
    dependencies: {
      jsonwebtoken: `^9.0.0`,
    },
  }),
}

const assets = {
  orgLogo: new Asset({
    type: `image/png`,
    userId: undefined,
    orgId: org.id,
    content: undefined,
    threadId: undefined,
    messageId: undefined,
    projectId: undefined,
    providerId: undefined,
    id: Ids.asset.acmeLogo,
    name: `Threaded Stack Logo`,
    url: `https://cdn.threadedstack.com/logo.png`,
    meta: {
      width: 512,
      height: 512,
      size: 45678,
      uploadedBy: users.owner.id,
    },
  }),
  projectDiagram: new Asset({
    orgId: undefined,
    userId: undefined,
    content: undefined,
    threadId: undefined,
    messageId: undefined,
    providerId: undefined,
    type: `image/svg+xml`,
    id: Ids.asset.projectDiagram,
    projectId: projects.api.id,
    name: `API Architecture Diagram`,
    url: `https://cdn.threadedstack.com/diagrams/api-arch.svg`,
    meta: {
      size: 12345,
      version: `2.0`,
      category: `documentation`,
    },
  }),
  userAvatar: new Asset({
    orgId: undefined,
    type: `image/jpeg`,
    content: undefined,
    threadId: undefined,
    messageId: undefined,
    projectId: undefined,
    providerId: undefined,
    userId: users.viewer.id,
    id: Ids.asset.userAvatar,
    name: `Profile Picture`,
    url: `https://cdn.threadedstack.com/avatars/viewer.jpg`,
    meta: {
      width: 256,
      height: 256,
      size: 23456,
    },
  }),
}

const threads = {
  planning: new Thread({
    public: false,
    userId: users.owner.id,
    id: Ids.thread.adminPlanning,
    name: `Q1 Planning Discussion`,
    projectId: projects.web.id,
    providerId: providers.openai.id,
    meta: {
      priority: `high`,
      tags: [`planning`, `q1-2024`],
    },
  }),
  support: new Thread({
    public: false,
    userId: users.admin.id,
    id: Ids.thread.adminSupport,
    projectId: projects.api.id,
    name: `Customer Support Issues`,
    providerId: providers.anthropic.id,
    meta: {
      tags: [`support`, `urgent`],
      category: `customer-service`,
    },
  }),
  dev: new Thread({
    public: false,
    userId: users.member.id,
    id: Ids.thread.memberDev,
    name: `API Development Chat`,
    projectId: projects.api.id,
    providerId: providers.anthropic.id,
    meta: {
      project: `api-backend`,
      tags: [`development`, `api`],
    },
  }),
}

const messages = {
  planningMsg1: new Message({
    type: `user`,
    id: Ids.message.thread1Msg1,
    threadId: threads.planning.id,
    content: {
      text: `What are our key objectives for Q1 2024?`,
      timestamp: new Date(`2024-01-05T10:00:00Z`).toISOString(),
    },
    meta: {
      role: `user`,
      modelVersion: null,
    },
  }),
  planningMsg2: new Message({
    type: `assistant`,
    id: Ids.message.thread1Msg2,
    threadId: threads.planning.id,
    content: {
      text: `Based on our previous discussions, here are the key Q1 objectives:\n1. Launch new API v2\n2. Expand team by 5 members\n3. Achieve 99.9% uptime SLA\n4. Complete security audit`,
      timestamp: new Date(`2024-01-05T10:00:15Z`).toISOString(),
    },
    meta: {
      role: `assistant`,
      modelVersion: `gpt-4-turbo`,
      tokensUsed: 87,
    },
  }),
  supportMsg1: new Message({
    type: `user`,
    id: Ids.message.thread2Msg1,
    threadId: threads.support.id,
    content: {
      text: `Customer reports slow response times on the dashboard`,
      timestamp: new Date(`2024-01-15T14:30:00Z`).toISOString(),
    },
    meta: {
      role: `user`,
      customerId: `cust_abc123`,
    },
  }),
  supportMsg2: new Message({
    type: `assistant`,
    id: Ids.message.thread2Msg2,
    threadId: threads.support.id,
    content: {
      text: `I can help investigate. Please check:\n1. Database query performance\n2. CDN cache status\n3. Recent deployments\n4. Server load metrics`,
      timestamp: new Date(`2024-01-15T14:30:20Z`).toISOString(),
    },
    meta: {
      tokensUsed: 56,
      role: `assistant`,
      modelVersion: `claude-3-opus-20240229`,
    },
  }),
}

const quotas = {
  jan2024: new Quota({
    projects: 5,
    members: 12,
    threads: 150,
    endpoints: 25,
    price: 150000,
    retention: 90,
    messages: 3500,
    orgSecrets: 15,
    runtime: 120000,
    organizations: 1,
    period: `2024-01`,
    projectSecrets: 45,
    orgId: org.id,
    functionCalls: 50000,
    id: Ids.quota.acme202401,
  }),
  feb2024: new Quota({
    price: 165000,
    retention: 90,
    projects: 6,
    members: 15,
    threads: 200,
    endpoints: 30,
    orgSecrets: 18,
    messages: 4200,
    runtime: 150000,
    organizations: 1,
    period: `2024-02`,
    orgId: org.id,
    projectSecrets: 52,
    functionCalls: 65000,
    id: Ids.quota.acme202402,
  }),
}

const invitations = {
  pending: new Invitation({
    userId: undefined,
    orgId: org.id,
    roleType: `member`,
    revokedAt: undefined,
    revokedBy: undefined,
    acceptedAt: undefined,
    invitedBy: users.owner.id,
    id: Ids.invitation.pending,
    status: EInviteStatus.pending,
    token: `invite_token_tdsk_123`,
    email: `newmember@threadedstack.com`,
    expiresAt: new Date(`2024-02-15T00:00:00Z`).toISOString(),
  }),
  accepted: new Invitation({
    orgId: org.id,
    roleType: `admin`,
    revokedAt: undefined,
    revokedBy: undefined,
    userId: users.admin.id,
    invitedBy: users.owner.id,
    id: Ids.invitation.accepted,
    email: users.admin.email,
    token: `invite_token_tdsk_456`,
    status: EInviteStatus.accepted,
    expiresAt: new Date(`2024-01-20T00:00:00Z`).toISOString(),
    acceptedAt: new Date(`2024-01-18T15:30:00Z`).toISOString(),
  }),
  expired: new Invitation({
    userId: undefined,
    roleType: `viewer`,
    revokedAt: undefined,
    revokedBy: undefined,
    acceptedAt: undefined,
    orgId: org.id,
    invitedBy: users.owner.id,
    id: Ids.invitation.expired,
    status: EInviteStatus.expired,
    token: `invite_token_tdsk_789`,
    email: `expired@threadedstack.com`,
    expiresAt: new Date(`2024-01-01T00:00:00Z`).toISOString(),
  }),
}

const domains = {
  orgDomain: new Domain({
    orgId: org.id,
    verified: true,
    sslEnabled: true,
    projectId: undefined,
    domain: `app.threadedstack.com`,
    id: `10000000-0000-0000-0000-000000000100`,
    verifiedAt: new Date(`2024-01-01T00:00:00Z`).toISOString(),
    sslExpiresAt: new Date(`2025-01-01T00:00:00Z`).toISOString(),
  }),
  apiDomain: new Domain({
    orgId: undefined,
    verified: true,
    projectId: projects.api.id,
    domain: `api.threadedstack.com`,
    id: `10000000-0000-0000-0000-000000000101`,
    verifiedAt: new Date(`2024-01-01T00:00:00Z`).toISOString(),
    sslEnabled: true,
    sslExpiresAt: new Date(`2025-01-01T00:00:00Z`).toISOString(),
  }),
}

const seeds = {
  // Core entities (no dependencies)
  org,
  users,
  // Organization-dependent entities
  projects,
  roles,
  subscriptions,
  providers,
  // Project-dependent entities
  endpoints,
  functions,
  apiKeys,
  secrets,
  agents,
  // User/Org/Project-dependent entities (polymorphic)
  assets,
  // Thread/Message entities
  threads,
  messages,
  // Organization tracking
  quotas,
  invitations,
  domains,
}
