/**
 * Role-Based Access Control (RBAC) Type Definitions
 *
 * Defines the permission system for the Threaded Stack platform.
 * Roles are hierarchical: viewer < member < admin < owner < super
 */

/**
 * Role types hierarchy (highest to lowest)
 */
export enum ERoleType {
  super = `super`, // Platform admin - full access across all orgs/projects
  owner = `owner`, // Org/Project creator - can delete/transfer ownership
  admin = `admin`, // Can manage members, settings, secrets
  member = `member`, // Can create/edit resources
  viewer = `viewer`, // Read-only access
}

export type TRoleType = `${ERoleType}`

/**
 * Permission actions that can be performed on resources
 */
export enum EPermAction {
  create = `create`, // Create new resources
  read = `read`, // View/list resources
  update = `update`, // Modify existing resources
  delete = `delete`, // Delete resources
  manage = `manage`, // Manage members, settings, advanced operations

  // TODO: Need to add a new action for execute against a resource (i.e. exec in Sandbox)
  //exec = `exec` // Execute an action using the resource
}

/**
 * Resources that can be protected by the RBAC system
 */
export enum EPermResource {
  org = `org`, // Organization
  project = `project`, // Project within an org
  user = `user`, // User accounts
  role = `role`, // User roles and permissions
  secret = `secret`, // API secrets/credentials
  apiKey = `apiKey`, // API keys for external access
  endpoint = `endpoint`, // Proxy endpoints
  provider = `provider`, // External service providers
  domain = `domain`, // User registered custom domains
  function = `function`, // Serverless functions (FaaS)
  agent = `agent`, // AI agents
  subscription = `subscription`, // Subscription plans
  quota = `quota`, // Usage quotas
  invitation = `invitation`, // User invitations
  thread = `thread`, // Conversation threads
  message = `message`, // Thread messages
  asset = `asset`, // Uploaded assets
  skill = `skill`, // Reusable agent skills
  schedule = `schedule`, // Agent cron schedules
  sandbox = `sandbox`, // Sandbox configurations
}

export type TPermAction = `${EPermAction}`
export type TPermResource = `${EPermResource}`
export type TPermScope = `${EPermScope}`

/**
 * Scope where permission applies
 */
export enum EPermScope {
  global = `global`, // Platform-wide (super admin only)
  org = `org`, // Organization level
  project = `project`, // Project level
}

/**
 * Permission definition - represents a single permission
 */
export type TPermission = {
  action: EPermAction
  resource: EPermResource
  scope: EPermScope
}

/**
 * Role with context - used for permission checks
 * Includes the role type and the context where it applies
 */
export type TRoleContext = {
  roleType: ERoleType
  orgId?: string // Organization ID if org/project scoped
  projectId?: string // Project ID if project scoped
  userId: string // User who has this role
}

/**
 * Permission check result
 * Indicates whether an action is allowed and why
 */
export type TPermCheckResult = {
  allowed: boolean
  reason?: string // Explanation if denied
  requiredRole?: ERoleType // Minimum role required for the action
}
