/**
 * Permission Utilities
 *
 * Core utilities for RBAC permission checking.
 * Implements a hierarchical role-based access control system.
 */

import type { TPermCheckResult } from '@TDM/types'
import type { EPermAction, EPermResource } from '@TDM/types'
import { ERoleType } from '@TDM/types'
import { RoleHierarchy, PermissionMatrix } from '@TDM/constants/values'

/**
 * Get the numeric level of a role in the hierarchy
 * Higher number = more permissions
 *
 * @param role - Role to get level for
 * @returns Numeric level (0-4)
 */
export const getRoleLevel = (role: ERoleType): number => {
  return RoleHierarchy.indexOf(role)
}

/**
 * Check if a user's role has at least the permissions of the required role
 * Uses hierarchical comparison - higher roles include all lower role permissions
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum role required
 * @returns True if user has sufficient permissions
 */
export const hasMinRole = (userRole: ERoleType, requiredRole: ERoleType): boolean => {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole)
}

/**
 * Check if a user can perform a specific action on a resource.
 * This is the main permission checking function.
 *
 * **Edge cases:**
 * - **Unknown resources/actions (U-M2):** If `resource` or `action` is not found in the
 *   `PermissionMatrix`, the function **fails closed** (returns `{ allowed: false }`).
 *   This is the safe default — unrecognized resource/action combos are denied.
 * - **Scope parameter (U-M3):** This function does not accept a `scope` parameter.
 *   All permission checks are purely role-based via `PermissionMatrix`. Org-level vs
 *   project-level scoping must be handled by the caller before invoking `canPerform`.
 *
 * @param userRole - The user's current role
 * @param action - The action being attempted
 * @param resource - The resource being accessed
 * @returns Result object with allowed status and optional reason
 */
export const canPerform = (
  userRole: ERoleType,
  action: EPermAction,
  resource: EPermResource
): TPermCheckResult => {
  const requiredRole = PermissionMatrix[resource]?.[action]

  if (!requiredRole) {
    return {
      allowed: false,
      reason: `Unknown permission: ${action} on ${resource}`,
    }
  }

  const allowed = hasMinRole(userRole, requiredRole)

  return {
    allowed,
    requiredRole,
    reason: allowed ? undefined : `Requires ${requiredRole} role or higher`,
  }
}

/**
 * Check if user can access secret values (not just metadata)
 * Secret values are only visible to admins and above
 * Members can see secret names but not values
 *
 * @param userRole - The user's current role
 * @returns True if user can access secret values
 */
export const canAccessSecretValue = (userRole: ERoleType): boolean => {
  return hasMinRole(userRole, ERoleType.admin)
}

/**
 * Check if user is a super admin (platform-wide access)
 * Super admins bypass all permission checks
 *
 * @param userRole - The user's current role
 * @returns True if user is super admin
 */
export const isSuperAdmin = (userRole: ERoleType): boolean => {
  return userRole === ERoleType.super
}

/**
 * Get the highest role from multiple role assignments
 * Useful when a user has multiple roles (e.g., admin in one org, member in another)
 *
 * @param roles - Array of roles to compare
 * @returns The highest role in the hierarchy
 */
export const getHighestRole = (roles: ERoleType[]): ERoleType => {
  if (!roles.length) return ERoleType.viewer

  return roles.reduce((highest, current) =>
    getRoleLevel(current) > getRoleLevel(highest) ? current : highest
  )
}

/**
 * Check if a role can manage another role
 * Rule: You can only manage roles below your level
 * e.g., Admins can manage members and viewers, but not other admins or owners
 *
 * @param managerRole - The role attempting to manage
 * @param targetRole - The role being managed
 * @returns True if manager can manage target
 */
export const canManageRole = (managerRole: ERoleType, targetRole: ERoleType): boolean => {
  // Super admin can manage anyone
  if (isSuperAdmin(managerRole)) return true

  // Can't manage roles at same level or higher
  return getRoleLevel(managerRole) > getRoleLevel(targetRole)
}

/**
 * Get all actions allowed for a role on a specific resource.
 * Useful for UI - shows what actions are available to current user.
 *
 * **Edge case:** If `resource` is not found in `PermissionMatrix`, returns an empty
 * array (fails closed — no actions are allowed for unknown resources).
 *
 * @param userRole - The user's current role
 * @param resource - The resource to check
 * @returns Array of allowed actions
 */
export const getAllowedActions = (
  userRole: ERoleType,
  resource: EPermResource
): EPermAction[] => {
  const permissions = PermissionMatrix[resource]
  if (!permissions) return []

  return Object.entries(permissions)
    .filter(([_, requiredRole]) => hasMinRole(userRole, requiredRole))
    .map(([action, _]) => action as EPermAction)
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
