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
 * @param role - Role to get level for, or null for non-members
 * @returns Numeric level (0-4), or -1 for null (non-member)
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
 * @param userRole - The user's current role, or null for non-members
 * @returns True if user can access secret values, false if null (non-member)
 */
export const canAccessSecretValue = (userRole: ERoleType | null): boolean => {
  if (userRole === null) return false
  return hasMinRole(userRole, ERoleType.admin)
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
 * e.g., Admins can manage members and viewers, but not other admins or owners
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
 * Useful for UI - shows what actions are available to current user.
 *
 * **Edge case:** If `resource` is not found in `PermissionMatrix`, returns an empty
 * array (fails closed — no actions are allowed for unknown resources).
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
