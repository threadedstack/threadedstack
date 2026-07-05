/**
 * Role-Based Access Control (RBAC) Type Definitions
 *
 * Defines the permission system for the Threaded Stack platform.
 * Roles are hierarchical: member < admin < owner < super
 */

/**
 * Role types hierarchy (highest to lowest)
 */
export enum ERoleType {
  super = `super`, // Platform admin - full access across all orgs/projects
  owner = `owner`, // Org/Project creator - can delete/transfer ownership
  admin = `admin`, // Can manage members, settings, secrets
  member = `member`, // Can create/edit resources
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
  exec = `exec`, // Execute an action using the resource (sandbox exec, agent run, function invoke)
  connect = `connect`, // Start/connect to sandbox sessions
  transfer = `transfer`, // Ownership transfer
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
  skillProposal = `skillProposal`, // Self-authored skills pending promotion
  taskProposal = `taskProposal`, // Self-sensed tasks pending promotion (P4a)
  escalation = `escalation`, // Structured escalations for needs the steward cannot yet act on (P4b)
  memory = `memory`, // Durable agent memories
  schedule = `schedule`, // Agent cron schedules
  sandbox = `sandbox`, // Sandbox configurations
  sandboxSession = `sandboxSession`, // Active sandbox sessions
  adminPanel = `adminPanel`, // Admin panel access
}

export type TPermAction = `${EPermAction}`
export type TPermResource = `${EPermResource}`

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

/**
 * Safe subset of user fields embedded in role responses.
 * Excludes sensitive fields (banned, banReason, emailVerified).
 */
export type TRoleUser = {
  id: string
  email?: string
  name?: string
  first?: string
  last?: string
  image?: string
}

/**
 * Context for permission checks.
 * Used by authorize middleware and checkPermission utility.
 */
export enum EPermScope {
  org = `org`,
  project = `project`,
}

export type TPermScope = `${EPermScope}`

export type TPermissionContext = {
  orgId?: string
  projectId?: string
  resourceId?: string
  scopeType?: TPermScope
}

/**
 * A permission string combining a resource and an action.
 * Format: "resource:action" (e.g., "sandbox:exec", "org:read")
 */
export type TPermission = `${EPermResource}:${EPermAction}`

export type TProjectRules = Array<{ projectId: string; roleType: string }>
export type TPermissionOverrides = Array<{
  permission: TPermission
  effect: string
  projectId?: string
}>
