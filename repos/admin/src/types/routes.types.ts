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
  OrgRepos = `/orgs/:orgId/repos`,

  // Repo routes (nested under org)
  Repo = `/orgs/:orgId/repos/:repoId`,
  RepoEndpoints = `/orgs/:orgId/repos/:repoId/endpoints`,
  RepoEndpoint = `/orgs/:orgId/repos/:repoId/endpoints/:endpointId`,
  RepoSecrets = `/orgs/:orgId/repos/:repoId/secrets`,
  RepoProviders = `/orgs/:orgId/repos/:repoId/providers`,
  RepoFunctions = `/orgs/:orgId/repos/:repoId/functions`,
  RepoFunction = `/orgs/:orgId/repos/:repoId/functions/:functionId`,
  RepoSettings = `/orgs/:orgId/repos/:repoId/settings`,

  // Catch-all
  Star = `*`,
}
