/**
 * Permission Utilities
 *
 * Core utilities for RBAC permission checking.
 * Implements a hierarchical role-based access control system
 * using explicit permission sets (RoleTemplates) instead of a permission matrix.
 */

import type { PermissionOverride } from '@TDM/models/permissionOverride'
import type { TPermCheckResult, TPermission } from '@TDM/types'

import { ERoleType, EPermAction, EPermResource, EPermScope } from '@TDM/types'
import { RoleHierarchy, RoleTemplates, ResourceScope } from '@TDM/constants/values'

/**
 * Get the numeric level of a role in the hierarchy
 * Higher number = more permissions
 *
 * Hierarchy: member(0), admin(1), owner(2), super(3)
 *
 * @param role - Role to get level for, or null for non-members
 * @returns Numeric level (0-3), or -1 for null/invalid
 */
export const getRoleLevel = (role: ERoleType | null): number => {
  if (role === null) return -1
  return RoleHierarchy.indexOf(role)
}

/**
 * Check if a user's role has at least the permissions of the required role
 * Uses hierarchical comparison - higher roles include all lower role permissions
 *
 * @param userRole - The user's current role, or null for non-members
 * @param requiredRole - The minimum role required
 * @returns True if user has sufficient permissions, false if null (non-member)
 */
export const hasMinRole = (
  userRole: ERoleType | null,
  requiredRole: ERoleType
): boolean => {
  if (userRole === null) return false
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole)
}

/**
 * Build the full set of permissions for a given role by accumulating
 * permissions from all role tiers at or below that role level.
 *
 * Super admins return an empty array because they bypass all permission checks.
 *
 * @param role - The role to build permissions for
 * @returns Array of permission strings
 */
export const buildRolePermissions = (role: ERoleType): TPermission[] => {
  if (role === ERoleType.super) return []

  const tiers: ERoleType[] = [ERoleType.member, ERoleType.admin, ERoleType.owner]
  const roleIdx = tiers.indexOf(role)
  if (roleIdx === -1) return []

  return tiers
    .slice(0, roleIdx + 1)
    .flatMap((tier) => RoleTemplates[tier as Exclude<ERoleType, 'super'>])
}

/**
 * Resolve the effective permission set for a user by combining their role's
 * default permissions with any active overrides.
 *
 * Grant overrides add permissions, deny overrides remove them.
 * Deny always wins: grants are applied first, then denies.
 * Expired overrides are ignored.
 *
 * Super admins return an empty set because they bypass all permission checks.
 *
 * @param roleType - The user's role
 * @param overrides - Per-user permission overrides
 * @returns Set of effective permission strings
 */
export const resolvePermissions = (
  roleType: ERoleType,
  overrides: PermissionOverride[]
): Set<TPermission> => {
  if (roleType === ERoleType.super) return new Set<TPermission>()

  const defaults = new Set<TPermission>(buildRolePermissions(roleType))

  const now = new Date()
  const active = overrides.filter((o) => !o.expiresAt || new Date(o.expiresAt) > now)

  for (const o of active) {
    if (o.effect === 'grant') defaults.add(o.permission)
  }

  for (const o of active) {
    if (o.effect === 'deny') defaults.delete(o.permission)
  }

  return defaults
}

export const isValidPermission = (perm: string): perm is TPermission => {
  const parts = perm.split(':')
  if (parts.length !== 2) return false
  const resources = Object.values(EPermResource) as string[]
  const actions = Object.values(EPermAction) as string[]
  return resources.includes(parts[0]) && actions.includes(parts[1])
}

export const isValidEffect = (effect: string): effect is `grant` | `deny` => {
  return effect === `grant` || effect === `deny`
}

export const filterPermissionsByScope = (
  permissions: TPermission[],
  keyScope: EPermScope | null
): TPermission[] => {
  if (!keyScope || keyScope === EPermScope.org) return permissions

  return permissions.filter((perm) => {
    const resource = perm.split(':')[0] as EPermResource
    return ResourceScope[resource] === EPermScope.project
  })
}

export const buildScopedPermissions = (
  role: ERoleType,
  keyScope: EPermScope | null
): TPermission[] => {
  return filterPermissionsByScope(buildRolePermissions(role), keyScope)
}

/**
 * Check if a user can perform a specific action on a resource.
 * This is the main permission checking function.
 *
 * Super admins bypass all checks.
 * For other roles, the action is allowed only if the role's accumulated
 * permissions include the requested resource:action pair.
 *
 * @param userRole - The user's current role, or null for non-members
 * @param action - The action being attempted
 * @param resource - The resource being accessed
 * @returns Result object with allowed status and optional reason
 */
export const canPerform = (
  userRole: ERoleType | null,
  action: EPermAction,
  resource: EPermResource
): TPermCheckResult => {
  if (userRole === null) {
    return {
      allowed: false,
      reason: `Not a member of this organization or project`,
    }
  }

  if (isSuperAdmin(userRole)) {
    return { allowed: true }
  }

  const permissions = new Set<TPermission>(buildRolePermissions(userRole))
  const permission: TPermission = `${resource}:${action}`
  const allowed = permissions.has(permission)

  return {
    allowed,
    reason: allowed ? undefined : `Permission denied: requires ${permission}`,
  }
}

/**
 * Check if user is a super admin (platform-wide access)
 * Super admins bypass all permission checks
 *
 * @param userRole - The user's current role, or null for non-members
 * @returns True if user is super admin, false if null (non-member)
 */
export const isSuperAdmin = (userRole: ERoleType | null): boolean => {
  if (userRole === null) return false
  return userRole === ERoleType.super
}

/**
 * Get the highest role from multiple role assignments
 * Useful when a user has multiple roles (e.g., admin in one org, member in another)
 *
 * @param roles - Array of roles to compare (may include null for non-members)
 * @returns The highest role in the hierarchy, or null if no valid roles
 */
export const getHighestRole = (roles: (ERoleType | null)[]): ERoleType | null => {
  const validRoles = roles.filter((r): r is ERoleType => r !== null)
  if (!validRoles.length) return null

  return validRoles.reduce((highest, current) =>
    getRoleLevel(current) > getRoleLevel(highest) ? current : highest
  )
}

/**
 * Check if a role can manage another role
 * Rule: You can only manage roles below your level
 * e.g., Admins can manage members, but not other admins or owners
 *
 * @param managerRole - The role attempting to manage, or null for non-members
 * @param targetRole - The role being managed
 * @returns True if manager can manage target, false if null (non-member)
 */
export const canManageRole = (
  managerRole: ERoleType | null,
  targetRole: ERoleType
): boolean => {
  if (managerRole === null) return false
  if (isSuperAdmin(managerRole)) return true
  return getRoleLevel(managerRole) > getRoleLevel(targetRole)
}

/**
 * Get all actions allowed for a role on a specific resource.
 * Uses buildRolePermissions to determine the role's full permission set,
 * then filters for actions matching the given resource.
 *
 * Super admins get all actions on every resource.
 *
 * @param userRole - The user's current role, or null for non-members
 * @param resource - The resource to check
 * @returns Array of allowed actions, empty if null (non-member)
 */
export const getAllowedActions = (
  userRole: ERoleType | null,
  resource: EPermResource
): EPermAction[] => {
  if (userRole === null) return []

  if (isSuperAdmin(userRole)) {
    return Object.values(EPermAction)
  }

  const permissions = buildRolePermissions(userRole)
  const prefix = `${resource}:`

  return permissions
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length) as EPermAction)
}

/**
 * Validate role type string
 * Ensures the string is a valid ERoleType
 *
 * @param role - String to validate
 * @returns True if valid role type
 */
export const isValidRoleType = (role: string): role is ERoleType => {
  return Object.values(ERoleType).includes(role as ERoleType)
}
