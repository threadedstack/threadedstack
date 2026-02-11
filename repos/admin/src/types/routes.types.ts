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

  Users = `users`,
  OrgUsers = `/orgs/:orgId/users`,

  Usage = `usage`,
  OrgUsage = `/orgs/:orgId/usage`,

  Secrets = `secrets`,
  OrgSecrets = `/orgs/:orgId/secrets`,

  Domains = `domains`,
  OrgDomains = `/orgs/:orgId/domains`,

  Settings = `settings`,
  OrgSettings = `/orgs/:orgId/settings`,

  Projects = `projects`,
  OrgProjects = `/orgs/:orgId/projects`,

  Providers = `providers`,
  OrgProviders = `/orgs/:orgId/providers`,

  ApiKeys = `api-keys`,
  OrgApiKeys = `/orgs/:orgId/api-keys`,

  // Project routes (nested under org)
  ProjectId = `projects/:projectId`,
  OrgProject = `/orgs/:orgId/projects/:projectId`,

  Agents = `agents`,
  ProjectAgents = `/orgs/:orgId/projects/:projectId/agents`,

  Threads = `threads`,
  ProjectThreads = `/orgs/:orgId/projects/:projectId/threads`,

  // In both organizations and projects
  ProjectSecrets = `/orgs/:orgId/projects/:projectId/secrets`,
  ProjectDomains = `/orgs/:orgId/projects/:projectId/domains`,
  ProjectSettings = `/orgs/:orgId/projects/:projectId/settings`,
  ProjectProviders = `/orgs/:orgId/projects/:projectId/providers`,

  Endpoints = `endpoints`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,

  Functions = `functions`,
  ProjectFunctions = `/orgs/:orgId/projects/:projectId/functions`,

  Function = `functions`,
  ProjectFunction = `/orgs/:orgId/projects/:projectId/functions/:functionId`,

  Endpoint = `endpoints`,
  ProjectEndpoint = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId`,

  // Catch-all
  Star = `*`,
}
