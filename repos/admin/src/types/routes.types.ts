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
  OrgUsers = `/orgs/:orgId/users`,
  OrgSecrets = `/orgs/:orgId/secrets`,
  OrgProviders = `/orgs/:orgId/providers`,
  OrgSettings = `/orgs/:orgId/settings`,
  OrgProjects = `/orgs/:orgId/projects`,
  OrgAi = `/orgs/:orgId/ai`,

  // Project routes (nested under org)
  Project = `/orgs/:orgId/projects/:projectId`,
  ProjectAi = `/orgs/:orgId/projects/:projectId/ai`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,
  ProjectEndpoint = `/orgs/:orgId/projects/:projectId/endpoints/:endpointId`,
  ProjectSecrets = `/orgs/:orgId/projects/:projectId/secrets`,
  ProjectProviders = `/orgs/:orgId/projects/:projectId/providers`,
  ProjectFunctions = `/orgs/:orgId/projects/:projectId/functions`,
  ProjectFunction = `/orgs/:orgId/projects/:projectId/functions/:functionId`,
  ProjectSettings = `/orgs/:orgId/projects/:projectId/settings`,

  // Catch-all
  Star = `*`,
}
