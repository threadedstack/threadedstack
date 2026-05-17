export enum EOrgSubPath {}

export enum ERoutePath {
  // Global routes
  Home = `/`,
  Auth = `/auth`,
  CliAuth = `/auth/cli`,
  Signin = `/auth/sign-in`,
  Signout = `/auth/sign-out`,
  AuthPage = `/auth/:pathname`,
  Profile = `profile`,
  Settings = `settings`,

  // Org routes
  Orgs = `orgs`,
  OrgScope = `orgs/:orgId`,

  // Project routes (nested under org)
  Projects = `projects`,
  ProjectScope = `projects/:projectId`,

  // Resource routes (nested under project)
  Sandbox = `sandbox/:sandboxId`,
  Instance = `sandbox/:sandboxId/instance/:instanceId`,

  // TODO: the session route is incorrect. It should be under the instance
  Session = `session/:sessionId`,

  // Catch-all
  Star = `*`,
}
