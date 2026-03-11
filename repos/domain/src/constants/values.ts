import { ERoleType, EPermAction, EPermResource } from '../types/permissions.types'

/**
 * Prefix for Threaded stack API keys
 */
export const ApiKeyPrefix = `tdsk_`

/**
 * Secret template reference patterns for {{ name:id }} format.
 * SecretRefTest — quick boolean check (no capture groups).
 * SecretRefPattern — global match with capture groups: [1]=name, [2]=10-char nanoid.
 */
export const SecretRefTest = /\{\{\s*.+?:[A-Za-z0-9_-]{10}\s*\}\}/
export const SecretRefPattern = /\{\{\s*(.+?):([A-Za-z0-9_-]{10})\s*\}\}/g

export const AuthHeaders = Object.freeze({
  [`user.userId`]: `X-User-Id`,
  [`user.role`]: `X-User-Role`,
  [`user.email`]: `X-User-Email`,
  [`user.orgId`]: `X-User-Org-Id`,
  [`user.projectId`]: `X-User-Project-Id`,
  [`user.apiKeyId`]: `X-User-Api-Key-Id`,
})

/**
 * Role hierarchy - higher index = more permissions
 * Each role inherits all permissions from roles below it
 */
export const RoleHierarchy: ERoleType[] = [
  ERoleType.viewer,
  ERoleType.member,
  ERoleType.admin,
  ERoleType.owner,
  ERoleType.super,
]

/**
 * Permission matrix - defines minimum role required for each action on each resource
 * Format: PermissionMatrix[resource][action] = minimumRequiredRole
 */
export const PermissionMatrix: Record<EPermResource, Record<EPermAction, ERoleType>> = {
  [EPermResource.org]: {
    [EPermAction.create]: ERoleType.member, // Any authenticated user can create orgs
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.owner,
    [EPermAction.manage]: ERoleType.admin, // Member management
  },
  [EPermResource.project]: {
    [EPermAction.create]: ERoleType.member, // Members can create projects in orgs
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member, // Members can update projects they created
    [EPermAction.delete]: ERoleType.admin, // Only admins can delete projects
    [EPermAction.manage]: ERoleType.admin, // Manage project settings/members
  },
  [EPermResource.agent]: {
    [EPermAction.create]: ERoleType.member, // Members can create agents in projects
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.member,
    [EPermAction.manage]: ERoleType.member,
  },
  [EPermResource.secret]: {
    [EPermAction.create]: ERoleType.admin,
    [EPermAction.read]: ERoleType.member, // Members can see secret names (not values)
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.apiKey]: {
    [EPermAction.create]: ERoleType.admin,
    [EPermAction.read]: ERoleType.admin, // API keys are sensitive
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.endpoint]: {
    [EPermAction.create]: ERoleType.member,
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.provider]: {
    [EPermAction.create]: ERoleType.admin, // Creating providers requires admin
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.user]: {
    [EPermAction.create]: ERoleType.admin, // Invite users to org/project
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.admin, // Update other users' roles
    [EPermAction.delete]: ERoleType.owner, // Only owner can remove users
    [EPermAction.manage]: ERoleType.admin, // Manage user roles/permissions
  },
  [EPermResource.function]: {
    [EPermAction.create]: ERoleType.member,
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.role]: {
    [EPermAction.create]: ERoleType.admin, // Only admins can create roles
    [EPermAction.read]: ERoleType.viewer, // Anyone can see roles
    [EPermAction.update]: ERoleType.admin, // Only admins can modify roles
    [EPermAction.delete]: ERoleType.owner, // Only owner can delete roles
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.domain]: {
    [EPermAction.create]: ERoleType.admin, // Creating domain requires admin
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.subscription]: {
    [EPermAction.create]: ERoleType.admin, // Only admins can create subscriptions
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.owner,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.quota]: {
    [EPermAction.create]: ERoleType.admin, // Only admins can create quotas
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.owner,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.invitation]: {
    [EPermAction.create]: ERoleType.admin, // Admins can invite users
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.thread]: {
    [EPermAction.create]: ERoleType.member, // Members can create threads
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.message]: {
    [EPermAction.create]: ERoleType.member, // Members can create messages
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.asset]: {
    [EPermAction.create]: ERoleType.member, // Members can upload assets
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.skill]: {
    [EPermAction.create]: ERoleType.member, // Members can create skills
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.schedule]: {
    [EPermAction.create]: ERoleType.member, // Members can create schedules
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.sandbox]: {
    [EPermAction.create]: ERoleType.admin, // Sandbox configs control K8s resources
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
}
