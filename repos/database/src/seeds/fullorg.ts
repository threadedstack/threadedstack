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

// --- Organization ---
const org = new Organization({
  id: Ids.org.tdsk,
  name: `Tdsk`,
  ownerId: Ids.super.user,
  description: `Developer platform that offers AI Agent management, functions as a service and API request proxying including secure dynamic secret injection`,
})

// --- Users ---
const users = {
  owner: new User({
    id: Ids.super.user,
    name: `Lance Tipton`,
    banExpires: undefined,
    emailVerified: false,
    email: `lancetipton04@gmail.com`,
  }),
  admin: new User({
    id: Ids.user.admin,
    name: `Test Admin`,
    emailVerified: false,
    email: `test.admin@threadedstack.com`,
  }),
  member: new User({
    id: Ids.user.member,
    name: `Test Member`,
    emailVerified: false,
    email: `test.member@threadedstack.com`,
  }),
  viewer: new User({
    id: Ids.user.viewer,
    name: `Test Viewer`,
    emailVerified: false,
    email: `test.viewer@threadedstack.com`,
  }),
}

// --- Org-Scoped Roles ---
const roles = {
  // Owner user gets 'super' role (unique constraint: one role per user per org)
  super: new Role({
    type: `super`,
    orgId: org.id,
    projectId: undefined,
    id: Ids.role.super,
    userId: users.owner.id,
    name: `Organization Super`,
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

// --- Projects ---
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

// --- Project-Scoped Roles (user <-> project membership) ---
const projectRoles = {
  adminApi: new Role({
    type: `admin`,
    orgId: undefined,
    projectId: projects.api.id,
    id: `20000000-0000-0000-0000-000000000010`,
    userId: users.admin.id,
    name: `API Backend Admin`,
  }),
  memberApi: new Role({
    type: `member`,
    orgId: undefined,
    projectId: projects.api.id,
    id: `20000000-0000-0000-0000-000000000011`,
    userId: users.member.id,
    name: `API Backend Member`,
  }),
  memberWeb: new Role({
    type: `member`,
    orgId: undefined,
    projectId: projects.web.id,
    id: `20000000-0000-0000-0000-000000000012`,
    userId: users.member.id,
    name: `Web Dashboard Member`,
  }),
  viewerWeb: new Role({
    type: `viewer`,
    orgId: undefined,
    projectId: projects.web.id,
    id: `20000000-0000-0000-0000-000000000013`,
    userId: users.viewer.id,
    name: `Web Dashboard Viewer`,
  }),
}

// --- Subscriptions ---
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

// --- API Keys ---
const apiKeys = {
  orgMaster: new ApiKey({
    active: true,
    rateLimit: 1000,
    orgId: org.id,
    projectId: undefined,
    userId: users.owner.id,
    scopes: `read,write,admin`,
    keyPrefix: `tdsk_QIWTcVw`,
    id: Ids.apikey.tdskOrgKey,
    expiresAt: new Date(`2025-12-31`),
    lastUsedAt: new Date(`2024-01-25`),
    name: `Threaded Stack Org Master Key`,
    keyHash: `e1a4f913e4f19a36a4fe09ffc431dadd0cd79b218c70b0a1adc46b7435a4919c`,
  }),
  apiProject: new ApiKey({
    active: true,
    rateLimit: 500,
    orgId: undefined,
    userId: users.admin.id,
    scopes: `read,write`,
    keyPrefix: `tdsk_XP0wDQi`,
    projectId: projects.api.id,
    name: `API Backend Project Key`,
    id: Ids.apikey.acmeApiProjectKey,
    expiresAt: new Date(`2024-12-31`),
    lastUsedAt: new Date(`2024-01-26`),
    keyHash: `5bf5a7b45c5c9450d5b993f4441bb8a4ee167a1b466a00377dc4ea43e65577df`,
  }),
}

// --- Providers ---
const providers = {
  openai: new Provider({
    orgId: org.id,
    type: EProvider.ai,
    id: Ids.provider.acmeOpenai,
    name: `OpenAI Provider`,
    options: {
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
      model: `claude-3-opus-20240229`,
    },
  }),
  zai: new Provider({
    orgId: org.id,
    type: EProvider.ai,
    id: Ids.provider.zai,
    name: `ZAI Provider`,
    options: {
      model: `glm-5`,
      tool_stream: true,
    },
  }),
}

// --- Secrets (all 4 exclusive arc scopes + combo) ---
const anthropicSecret = await encryptSecret(
  `Anthropic API Key`,
  `sk-ant-test-key-for-seeding`,
  Ids.project.acmeApi
)

const zaiSecret = await encryptSecret(
  `ZAI API Key`,
  process.env.TDSK_ZAI_KEY || `sk-zai-test-key-for-seeding`,
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

const openaiProviderSecret = await encryptSecret(
  `OpenAI API Key`,
  `sk-test-openai-key-for-seeding`,
  Ids.provider.acmeOpenai
)

const agentEnvSecret = await encryptSecret(
  `Agent Environment Config`,
  `agent-specific-secret-value`,
  Ids.agent.codingAgent
)

const secrets = {
  // Org+Provider combo-scoped secret
  anthropic: new Secret({
    orgId: org.id,
    agentId: null as any,
    projectId: null as any,
    name: `Anthropic API Key`,
    hashKey: anthropicSecret.hashKey,
    providerId: providers.anthropic.id,
    id: Ids.secret.providerAnthropicKey,
    description: `Anthropic API authentication key`,
    encryptedValue: anthropicSecret.encryptedValue,
  }),
  // Project-scoped secret
  database: new Secret({
    orgId: null as any,
    agentId: null as any,
    providerId: null as any,
    name: `Database Password`,
    hashKey: databaseSecret.hashKey,
    id: Ids.secret.acmeDbPassword,
    projectId: Ids.project.acmeApi,
    description: `Production database password`,
    encryptedValue: databaseSecret.encryptedValue,
  }),
  // Org-scoped secret
  github: new Secret({
    projectId: null as any,
    agentId: null as any,
    providerId: null as any,
    orgId: org.id,
    id: Ids.secret.githubToken,
    name: `GitHub Token`,
    hashKey: githubSecret.hashKey,
    description: `GitHub PAT for repository access`,
    encryptedValue: githubSecret.encryptedValue,
  }),
  // Org+Provider combo-scoped secret
  openaiKey: new Secret({
    orgId: org.id,
    agentId: null as any,
    projectId: null as any,
    name: `OpenAI API Key`,
    id: Ids.secret.acmeApiKey,
    providerId: providers.openai.id,
    hashKey: openaiProviderSecret.hashKey,
    description: `OpenAI API key for provider`,
    encryptedValue: openaiProviderSecret.encryptedValue,
  }),
  // Agent-scoped secret
  agentEnv: new Secret({
    orgId: null as any,
    projectId: null as any,
    providerId: null as any,
    agentId: Ids.agent.codingAgent,
    id: Ids.secret.acmeProjectSecret,
    name: `Agent Environment Config`,
    hashKey: agentEnvSecret.hashKey,
    description: `Agent-specific environment configuration`,
    encryptedValue: agentEnvSecret.encryptedValue,
  }),
  // Org+Provider combo-scoped secret
  zaiSecret: new Secret({
    orgId: org.id,
    agentId: null as any,
    projectId: null as any,
    name: `ZAI API Key`,
    id: Ids.secret.zaiKey,
    hashKey: zaiSecret.hashKey,
    providerId: providers.zai.id,
    description: `ZAI API authentication key`,
    encryptedValue: zaiSecret.encryptedValue,
  }),
}

// --- Agents ---
const agents = {
  coding: new Agent({
    orgId: org.id,
    id: Ids.agent.codingAgent,
    name: `Coding Agent`,
    description: `A coding AI Agent`,
    model: `claude-3-opus-20240229`,
    projects: Object.values(projects),
    providers: [providers.openai],
    systemPrompt: `You are a senior software engineer.`,
    secrets: [secrets.anthropic, secrets.agentEnv],
    tools: [`readFile`, `writeFile`, `shellExec`],
    environment: {
      timeout: 30000,
      memory: 512,
      streaming: true,
      temperature: 0.3,
      maxRetries: 2,
    },
  }),
  chat: new Agent({
    orgId: org.id,
    id: Ids.agent.chatAgent,
    name: `Chat Agent`,
    description: `Conversational AI`,
    model: `claude-3-opus-20240229`,
    projects: [projects.api, projects.web],
    providers: [providers.zai, providers.openai],
    systemPrompt: `Answer the users questions.`,
    secrets: [secrets.anthropic],
    environment: {
      streaming: true,
      temperature: 0.7,
    },
  }),
  general: new Agent({
    orgId: org.id,
    id: Ids.agent.generalAgent,
    name: `General Agent`,
    description: `General well rounded AI Agent`,
    model: `glm-5`,
    projects: [projects.api, projects.web],
    providers: [providers.zai, providers.anthropic, providers.openai],
    systemPrompt: `Answer the users questions.`,
    secrets: [secrets.zaiSecret],
    environment: {
      streaming: true,
      temperature: 0.7,
    },
  }),
}

// --- Endpoints ---
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
  validator: new FaaSEndpoint({
    name: `User Validator`,
    path: `/api/v1/validate`,
    type: EEndpointType.faas,
    projectId: projects.api.id,
    id: Ids.endpoint.acmeApiValidator,
    method: `POST`,
    public: false,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 1,
      timeout: 10000,
      type: EEndpointType.faas,
      functionId: Ids.function.acmeUserValidator,
    },
  }),
}

// --- Functions ---
const funcs = {
  userValidator: new FunctionModel({
    id: Ids.function.acmeUserValidator,
    projectId: projects.api.id,
    endpointId: endpoints.validator.id,
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

// --- Assets (all 5 exclusive arc scopes + provider link) ---
const assets = {
  // Org-scoped asset
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
  // Project-scoped asset
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
  // User-scoped asset
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
  // Thread-scoped asset
  threadAttachment: new Asset({
    orgId: undefined,
    userId: undefined,
    content: undefined,
    messageId: undefined,
    projectId: undefined,
    providerId: undefined,
    type: `application/pdf`,
    threadId: Ids.thread.adminPlanning,
    id: Ids.asset.threadAttachment,
    name: `Q1 Planning Document`,
    url: `https://cdn.threadedstack.com/docs/q1-plan.pdf`,
    meta: {
      size: 156789,
      pages: 12,
      category: `planning`,
    },
  }),
  // Message-scoped asset
  messageImage: new Asset({
    orgId: undefined,
    userId: undefined,
    content: undefined,
    threadId: undefined,
    projectId: undefined,
    providerId: undefined,
    type: `image/png`,
    messageId: Ids.message.thread2Msg2,
    id: Ids.asset.messageImage,
    name: `Dashboard Performance Chart`,
    url: `https://cdn.threadedstack.com/charts/perf-metrics.png`,
    meta: {
      width: 1024,
      height: 768,
      size: 87654,
      chartType: `line`,
    },
  }),
  // User-scoped asset with provider link (providerId is independent, not part of arc)
  providerConfig: new Asset({
    orgId: undefined,
    threadId: undefined,
    messageId: undefined,
    projectId: undefined,
    content: { defaultModel: `gpt-4-turbo`, maxTokens: 4096 },
    type: `application/json`,
    userId: users.owner.id,
    providerId: providers.openai.id,
    id: Ids.asset.providerConfig,
    name: `OpenAI Provider Configuration`,
    url: undefined,
    meta: {
      category: `configuration`,
      provider: `openai`,
    },
  }),
}

// --- Threads (with orgId, agentId, projectId relationships) ---
const threads = {
  planning: new Thread({
    public: false,
    orgId: org.id,
    userId: users.owner.id,
    agentId: agents.chat.id,
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
    orgId: org.id,
    userId: users.admin.id,
    agentId: agents.chat.id,
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
    orgId: org.id,
    userId: users.member.id,
    agentId: agents.coding.id,
    id: Ids.thread.memberDev,
    name: `API Development Chat`,
    projectId: projects.api.id,
    providerId: providers.anthropic.id,
    meta: {
      project: `api-backend`,
      tags: [`development`, `api`],
    },
  }),
  viewer: new Thread({
    public: true,
    orgId: org.id,
    userId: users.viewer.id,
    agentId: agents.chat.id,
    id: Ids.thread.viewer,
    name: `General Q&A`,
    projectId: projects.web.id,
    providerId: providers.anthropic.id,
    meta: {
      tags: [`general`, `questions`],
    },
  }),
}

// --- Messages (using TMessageContent[] format for content field) ---
const messages = {
  planningMsg1: new Message({
    type: `user`,
    orgId: org.id,
    projectId: projects.web.id,
    id: Ids.message.thread1Msg1,
    threadId: threads.planning.id,
    content: [
      {
        type: `text`,
        text: `What are our key objectives for Q1 2024?`,
      },
    ],
    meta: {
      role: `user`,
    },
  }),
  planningMsg2: new Message({
    type: `assistant`,
    orgId: org.id,
    projectId: projects.web.id,
    id: Ids.message.thread1Msg2,
    threadId: threads.planning.id,
    content: [
      {
        type: `text`,
        text: `Based on our previous discussions, here are the key Q1 objectives:\n1. Launch new API v2\n2. Expand team by 5 members\n3. Achieve 99.9% uptime SLA\n4. Complete security audit`,
      },
    ],
    meta: {
      role: `assistant`,
      modelVersion: `gpt-4-turbo`,
      tokensUsed: 87,
    },
  }),
  supportMsg1: new Message({
    type: `user`,
    orgId: org.id,
    projectId: projects.api.id,
    id: Ids.message.thread2Msg1,
    threadId: threads.support.id,
    content: [
      {
        type: `text`,
        text: `Customer reports slow response times on the dashboard`,
      },
    ],
    meta: {
      role: `user`,
      customerId: `cust_abc123`,
    },
  }),
  supportMsg2: new Message({
    type: `assistant`,
    orgId: org.id,
    projectId: projects.api.id,
    id: Ids.message.thread2Msg2,
    threadId: threads.support.id,
    content: [
      {
        type: `text`,
        text: `I can help investigate. Please check:\n1. Database query performance\n2. CDN cache status\n3. Recent deployments\n4. Server load metrics`,
      },
    ],
    meta: {
      tokensUsed: 56,
      role: `assistant`,
      modelVersion: `claude-3-opus-20240229`,
    },
  }),
  devMsg1: new Message({
    type: `user`,
    orgId: org.id,
    projectId: projects.api.id,
    id: Ids.message.thread3Msg1,
    threadId: threads.dev.id,
    content: [
      {
        type: `text`,
        text: `Can you help me refactor the authentication middleware to support API key validation?`,
      },
    ],
    meta: {
      role: `user`,
    },
  }),
  viewerMsg1: new Message({
    type: `user`,
    orgId: org.id,
    projectId: projects.web.id,
    id: Ids.message.thread4Msg1,
    threadId: threads.viewer.id,
    content: [
      {
        type: `text`,
        text: `How do I configure a new endpoint in the dashboard?`,
      },
    ],
    meta: {
      role: `user`,
    },
  }),
}

// --- Quotas ---
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
    period: `2026-01`,
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
    period: `2026-02`,
    orgId: org.id,
    projectSecrets: 52,
    functionCalls: 65000,
    id: Ids.quota.acme202402,
  }),
}

// --- Invitations (all 4 statuses) ---
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
  revoked: new Invitation({
    userId: undefined,
    roleType: `member`,
    acceptedAt: undefined,
    orgId: org.id,
    invitedBy: users.owner.id,
    revokedBy: users.owner.id,
    id: Ids.invitation.revoked,
    status: EInviteStatus.revoked,
    token: `invite_token_tdsk_revoked`,
    email: `revoked@threadedstack.com`,
    expiresAt: new Date(`2024-03-01T00:00:00Z`).toISOString(),
    revokedAt: new Date(`2024-01-20T10:00:00Z`).toISOString(),
  }),
}

// --- Domains ---
const domains = {
  orgDomain: new Domain({
    orgId: org.id,
    verified: true,
    sslEnabled: true,
    projectId: undefined,
    domain: `app.threadedstack.com`,
    id: `10000000-0000-0000-0000-000000000100`,
    verifiedAt: new Date(`2024-01-01T00:00:00Z`),
    sslExpiresAt: new Date(`2025-01-01T00:00:00Z`),
  }),
  apiDomain: new Domain({
    orgId: undefined,
    verified: true,
    projectId: projects.api.id,
    domain: `api.threadedstack.com`,
    id: `10000000-0000-0000-0000-000000000101`,
    verifiedAt: new Date(`2024-01-01T00:00:00Z`),
    sslEnabled: true,
    sslExpiresAt: new Date(`2025-01-01T00:00:00Z`),
  }),
}

/**
 * Full organization seed data
 * Contains everything needed to create a complete org with all entity types
 *
 * Entity relationships:
 * - Organization has ownerId -> users.owner
 * - Roles: org-scoped (owner/admin/member/viewer) + project-scoped (admin/member/viewer)
 * - Providers: org-scoped (openai, anthropic)
 * - Agents: linked to providers via junction table, projects via junction table, functions via junction table
 * - Secrets: covers all 4 exclusive arc scopes (org, project, provider, agent)
 * - Assets: covers all 5 exclusive arc scopes (org, project, user, thread, message) + provider link
 * - Threads: linked to org, project, agent, provider, and user
 * - Messages: linked to thread, org, and project with TMessageContent[] format
 * - Invitations: all 4 statuses (pending, accepted, expired, revoked)
 */
export const seeds = {
  // Core entities
  org,
  users,
  // Organization membership
  roles,
  projectRoles,
  subscriptions,
  // Infrastructure
  providers,
  projects,
  // Security
  secrets,
  apiKeys,

  // Code
  endpoints,
  functions: funcs,
  // AI
  agents,
  // Conversations
  threads,
  messages,
  // Files
  assets,
  // Tracking
  quotas,
  invitations,
  domains,
}
