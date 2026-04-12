export enum EOrgSubPath {}

export enum ERoutePath {
  // Global routes
  Home = `/`,
  Auth = `/auth`,
  Signin = `/auth/sign-in`,
  Signout = `/auth/sign-out`,
  AuthPage = `/auth/:pathname`,
  Profile = `profile`,
  Settings = `settings`,
  Project = `project/:projectId`,
  Sandbox = `sandbox/:sandboxId`,
  Session = `session/:sandboxId`,
  // Catch-all
  Star = `*`,
}
