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

  // Team routes (top level)
  Teams = `/teams`,
  Team = `/teams/:teamId`,
  TeamUsers = `/teams/:teamId/users`,
  TeamSecrets = `/teams/:teamId/secrets`,
  TeamProviders = `/teams/:teamId/providers`,
  TeamSettings = `/teams/:teamId/settings`,
  TeamRepos = `/teams/:teamId/repos`,

  // Repo routes (nested under team)
  Repo = `/teams/:teamId/repos/:repoId`,
  RepoEndpoints = `/teams/:teamId/repos/:repoId/endpoints`,
  RepoEndpoint = `/teams/:teamId/repos/:repoId/endpoints/:endpointId`,
  RepoSecrets = `/teams/:teamId/repos/:repoId/secrets`,
  RepoProviders = `/teams/:teamId/repos/:repoId/providers`,
  RepoFunctions = `/teams/:teamId/repos/:repoId/functions`,
  RepoFunction = `/teams/:teamId/repos/:repoId/functions/:functionId`,
  RepoSettings = `/teams/:teamId/repos/:repoId/settings`,

  // Catch-all
  Star = `*`,
}
