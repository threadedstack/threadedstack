export enum ERoutePath {
  // Global routes
  Home = `/`,
  Auth = `/auth`,
  Login = `/auth/:pathname`,
  Account = `/account/:pathname`,
  Settings = `/settings`,
  Profile = `/profile`,
  ApiTokens = `/api-tokens`,

  // Org routes (top level)
  Orgs = `/orgs`,
  Org = `/orgs/:orgId`,
  OrgUsers = `/orgs/:orgId/users`,
  OrgUsage = `/orgs/:orgId/usage`,
  OrgSecrets = `/orgs/:orgId/secrets`,
  OrgDomains = `/orgs/:orgId/domains`,
  OrgSettings = `/orgs/:orgId/settings`,
  OrgProjects = `/orgs/:orgId/projects`,
  OrgProviders = `/orgs/:orgId/providers`,

  // Billing routes
  Billing = `/billing`,

  // Project routes (nested under org)
  Project = `/orgs/:orgId/projects/:projectId`,
  ProjectAgents = `/orgs/:orgId/projects/:projectId/agents`,
  ProjectThreads = `/orgs/:orgId/projects/:projectId/threads`,
  ProjectSecrets = `/orgs/:orgId/projects/:projectId/secrets`,
  ProjectDomains = `/orgs/:orgId/projects/:projectId/domains`,
  ProjectSettings = `/orgs/:orgId/projects/:projectId/settings`,
  ProjectProviders = `/orgs/:orgId/projects/:projectId/providers`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,
  ProjectFunctions = `/orgs/:orgId/projects/:projectId/functions`,
  ProjectFunction = `/orgs/:orgId/projects/:projectId/functions/:functionId`,
  ProjectEndpoint = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId`,

  // Catch-all
  Star = `*`,
}
