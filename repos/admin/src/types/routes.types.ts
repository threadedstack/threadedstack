export enum ERoutePath {
  // Global routes
  Home = `/`,
  Auth = `/auth`,
  Login = `/auth/:pathname`,
  Account = `/account/:pathname`,
  Settings = `/settings`,
  Profile = `/profile`,
  AI = `/ai`,
  AIAgents = `/ai/agents`,
  MCPTools = `/ai/mcp-tools`,
  ApiTokens = `/api-tokens`,

  // Org routes (top level)
  Orgs = `/orgs`,
  Org = `/orgs/:orgId`,
  OrgAi = `/orgs/:orgId/ai`,
  OrgUsers = `/orgs/:orgId/users`,
  OrgUsage = `/orgs/:orgId/usage`,
  OrgSecrets = `/orgs/:orgId/secrets`,
  OrgSettings = `/orgs/:orgId/settings`,
  OrgProjects = `/orgs/:orgId/projects`,
  OrgProviders = `/orgs/:orgId/providers`,

  // Billing routes
  Billing = `/billing`,

  // Project routes (nested under org)
  Project = `/orgs/:orgId/projects/:projectId`,
  ProjectAi = `/orgs/:orgId/projects/:projectId/ai`,
  ProjectSecrets = `/orgs/:orgId/projects/:projectId/secrets`,
  ProjectSettings = `/orgs/:orgId/projects/:projectId/settings`,
  ProjectProviders = `/orgs/:orgId/projects/:projectId/providers`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,
  ProjectFunctions = `/orgs/:orgId/projects/:projectId/functions`,
  ProjectFunction = `/orgs/:orgId/projects/:projectId/functions/:functionId`,
  ProjectEndpoint = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId`,

  // Catch-all
  Star = `*`,
}
