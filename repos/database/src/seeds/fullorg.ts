import { Ids } from '@TDB/seeds/ids.seed'
import {
  Role,
  Agent,
  User,
  Secret,
  Project,
  Provider,
  EProvider,
  Subscription,
  Organization,
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
    id: Ids.role.ownerAcme,
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

const providers = {
  openai: new Provider({
    orgId: org.id,
    userId: undefined,
    type: EProvider.ai,
    projectId: undefined,
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
    userId: undefined,
    type: EProvider.ai,
    projectId: undefined,
    id: Ids.provider.acmeAnthropic,
    name: `Anthropic Provider`,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
}

const secrets = {
  anthropic: new Secret({
    orgId: undefined,
    providerId: undefined,
    name: `Anthropic API Key`,
    hashKey: `hash_anthropic_key`,
    projectId: Ids.project.acmeApi,
    id: Ids.secret.providerAnthropicKey,
    description: `Anthropic API authentication key`,
    encryptedValue: `encrypted_anthropic_key_value`,
  }),
  database: new Secret({
    orgId: undefined,
    providerId: undefined,
    name: `Database Password`,
    hashKey: `hash_acme_db_pwd`,
    id: Ids.secret.acmeDbPassword,
    projectId: Ids.project.acmeApi,
    description: `Production database password`,
    encryptedValue: `encrypted_acme_db_password_value`,
  }),
  github: new Secret({
    name: `GitHub Token`,
    projectId: undefined,
    providerId: undefined,
    orgId: Ids.project.acmeApi,
    id: Ids.secret.githubToken,
    hashKey: `hash_github_token`,
    description: `GitHub PAT`,
    encryptedValue: `encrypted_github_token_value`,
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
    providerId: Ids.provider.startupAnthropic,
    systemPrompt: `Answer the users questions.`,
    secrets: [secrets.anthropic],
  }),
}

const seeds = {
  org,
  users,
  roles,
  agents,
  secrets,
  projects,
  subscriptions,
}
