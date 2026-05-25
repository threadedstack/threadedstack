export enum EOrgSubPath {}

export enum ERoutePath {
  // Global routes
  Home = `/`,
  Auth = `/auth`,
  Signin = `/auth/sign-in`,
  Signout = `/auth/sign-out`,
  AuthPage = `/auth/:pathname`,
  Account = `/account/:pathname`,

  Profile = `profile`,
  Billing = `billing`,

  // Org routes (top level)
  Orgs = `/orgs`,
  Org = `/orgs/:orgId`,

  OrgMembers = `/orgs/:orgId/members`,

  Usage = `usage`,
  OrgUsage = `/orgs/:orgId/usage`,

  Skills = `skills`,
  OrgSkills = `/orgs/:orgId/skills`,

  Schedules = `schedules`,
  ProjectSchedules = `/orgs/:orgId/projects/:projectId/schedules`,

  Secrets = `secrets`,
  OrgSecrets = `/orgs/:orgId/secrets`,

  Domains = `domains`,
  OrgDomains = `/orgs/:orgId/domains`,

  Settings = `settings`,
  OrgSettings = `/orgs/:orgId/settings`,

  Permissions = `permissions`,
  OrgPermissions = `/orgs/:orgId/permissions`,

  Projects = `projects`,
  OrgProjects = `/orgs/:orgId/projects`,

  Providers = `providers`,
  OrgProviders = `/orgs/:orgId/providers`,

  Sandboxes = `sandboxes`,
  OrgSandboxes = `/orgs/:orgId/sandboxes`,
  ProjectSandboxes = `/orgs/:orgId/projects/:projectId/sandboxes`,

  ApiKeys = `api-keys`,
  OrgApiKeys = `/orgs/:orgId/api-keys`,

  OrgAgents = `/orgs/:orgId/agents`,

  // Project routes (nested under org)
  ProjectId = `projects/:projectId`,
  OrgProject = `/orgs/:orgId/projects/:projectId`,

  Agents = `agents`,
  Agent = `agents/:agentId`,
  ProjectAgents = `/orgs/:orgId/projects/:projectId/agents`,

  Threads = `threads`,
  ProjectThreads = `/orgs/:orgId/projects/:projectId/threads`,

  AgentChat = `agents/:agentId/chat`,
  AgentThreads = `agents/:agentId/threads`,
  ProjectAgent = `/orgs/:orgId/projects/:projectId/agents/:agentId`,
  ProjectAgentChat = `/orgs/:orgId/projects/:projectId/agents/:agentId/chat`,
  ProjectAgentThreads = `/orgs/:orgId/projects/:projectId/agents/:agentId/threads`,

  AgentThreadDetail = `threads/:threadId`,
  AgentThreadChat = `threads/:threadId/chat`,
  ProjectAgentThreadDetail = `/orgs/:orgId/projects/:projectId/agents/:agentId/threads/:threadId`,
  ProjectAgentThreadChat = `/orgs/:orgId/projects/:projectId/agents/:agentId/threads/:threadId/chat`,

  // In both organizations and projects
  ProjectSecrets = `/orgs/:orgId/projects/:projectId/secrets`,
  ProjectDomains = `/orgs/:orgId/projects/:projectId/domains`,
  ProjectApiKeys = `/orgs/:orgId/projects/:projectId/api-keys`,
  ProjectSettings = `/orgs/:orgId/projects/:projectId/settings`,

  Endpoints = `endpoints`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,

  Functions = `functions`,
  ProjectFunctions = `/orgs/:orgId/projects/:projectId/functions`,

  Members = `members`,
  ProjectMembers = `/orgs/:orgId/projects/:projectId/members`,

  Function = `functions`,
  ProjectFunction = `/orgs/:orgId/projects/:projectId/functions/:functionId`,

  Endpoint = `endpoints/:endpointId`,
  ProjectEndpoint = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId`,
  ProjectEndpointConfig = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId/config`,
  ProjectEndpointTest = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId/test`,

  // Catch-all
  Star = `*`,
}
